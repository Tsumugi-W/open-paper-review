/**
 * BullMQ Worker - Main entry point.
 * Connects to Redis, creates the BullMQ worker, and processes review jobs.
 */

import { Worker, type Job } from "bullmq";
import Redis from "ioredis";

import { loadConfig } from "./config.js";
import { createProcessor, type ReviewJobData, type ReviewJobResult } from "./processor.js";
import {
  startHealthServer,
  setRedisClient,
  setProcessingState,
  setActiveJobCount,
  setQueueBacklog,
} from "./health.js";
import { loadProviderFromProfile } from "./provider-factory.js";
import { loadVenueBundle } from "./venue-loader.js";
import { getDb, getDefaultModelProfile } from "@opr/db";
import type { WorkflowProvider } from "@opr/core/workflow";

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[worker] Starting review worker...");

  // Load and validate configuration
  const config = loadConfig();
  console.log(`[worker] Concurrency: ${config.concurrency}`);
  console.log(`[worker] Queue: ${config.queueName}`);

  // Connect to Redis
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  redis.on("connect", () => {
    console.log("[worker] Redis connected");
  });

  redis.on("error", (err) => {
    console.error("[worker] Redis connection error:", err.message);
  });

  // Wait for Redis to be ready
  await new Promise<void>((resolve, reject) => {
    if (redis.status === "ready") {
      resolve();
      return;
    }
    redis.once("ready", resolve);
    redis.once("error", reject);
  });

  // Set up health check state
  setRedisClient(redis);

  // Pre-load the default model profile for the worker
  const db = getDb();
  const defaultProfile = await getDefaultModelProfile(db);
  if (!defaultProfile) {
    console.warn(
      "[worker] No default model profile configured. " +
        "Jobs must include __modelProfile in their config.",
    );
  } else {
    console.log(
      `[worker] Default model profile: ${defaultProfile.name} (${defaultProfile.provider}/${defaultProfile.model})`,
    );
  }

  // Create the job processor
  const processor = createProcessor({
    redis,
    createProvider: (jobConfig) => {
      // If the job config includes a pre-loaded model profile, use it directly
      const embeddedProfile = jobConfig?.__modelProfile as
        | {
            id: string;
            name: string;
            provider: "openai" | "anthropic" | "gemini" | "openrouter";
            model: string;
            apiKeyEncrypted: string;
            config?: Record<string, unknown> | null;
            isDefault: boolean;
          }
        | undefined;

      if (embeddedProfile) {
        // ProviderAdapter is structurally compatible with WorkflowProvider
        return loadProviderFromProfile(embeddedProfile) as unknown as WorkflowProvider;
      }

      // Fall back to the default profile loaded at startup
      if (!defaultProfile) {
        throw new Error(
          "No model profile available. Configure a default model profile or include __modelProfile in job config.",
        );
      }

      return loadProviderFromProfile({
        id: defaultProfile.id,
        name: defaultProfile.name,
        provider: defaultProfile.provider,
        model: defaultProfile.model,
        apiKeyEncrypted: defaultProfile.apiKeyEncrypted,
        config: defaultProfile.config as Record<string, unknown> | null,
        isDefault: defaultProfile.isDefault,
      }) as unknown as WorkflowProvider;
    },
    loadVenueBundle: async (venueBundleId) => {
      return loadVenueBundle(venueBundleId);
    },
  });

  // Create BullMQ worker
  const worker = new Worker<ReviewJobData, ReviewJobResult>(
    config.queueName,
    processor,
    {
      connection: redis,
      concurrency: config.concurrency,
      lockDuration: 300_000, // 5 minutes - stages can take time
      lockRenewTime: 150_000, // Renew lock every 2.5 minutes
      stalledInterval: 600_000, // 10 minutes before considering stalled
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  // Track active jobs for health reporting
  let activeJobs = 0;

  worker.on("active", (job: Job) => {
    activeJobs++;
    setActiveJobCount(activeJobs);
    console.log(`[worker] Job ${job.id} started (active: ${activeJobs})`);
  });

  worker.on("completed", (job: Job) => {
    activeJobs = Math.max(0, activeJobs - 1);
    setActiveJobCount(activeJobs);
    console.log(`[worker] Job ${job.id} completed (active: ${activeJobs})`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    activeJobs = Math.max(0, activeJobs - 1);
    setActiveJobCount(activeJobs);
    console.error(`[worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`);
  });

  worker.on("error", (err: Error) => {
    console.error("[worker] Worker error:", err.message);
  });

  worker.on("stalled", (jobId: string) => {
    console.warn(`[worker] Job ${jobId} stalled`);
  });

  // Mark as processing
  setProcessingState(true);
  console.log("[worker] Worker is ready and processing jobs");

  // Start health check server
  const healthServer = startHealthServer(config.healthPort);

  // Periodically update queue backlog count
  const backlogInterval = setInterval(async () => {
    try {
      const waiting = await redis.llen(`bull:${config.queueName}:wait`);
      setQueueBacklog(waiting);
    } catch {
      // Ignore backlog check errors
    }
  }, 10_000);

  // ─── Graceful Shutdown ─────────────────────────────────────────────────

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[worker] Received ${signal}, initiating graceful shutdown...`);

    // Stop accepting new jobs
    setProcessingState(false);
    clearInterval(backlogInterval);

    try {
      // Close the worker - waits for current jobs to reach a safe point
      // BullMQ's close() waits for running jobs to finish
      console.log("[worker] Waiting for active jobs to complete...");
      await worker.close();
      console.log("[worker] Worker closed");
    } catch (err) {
      console.error("[worker] Error closing worker:", (err as Error).message);
    }

    // Close health server
    healthServer.close();

    // Disconnect Redis
    try {
      await redis.quit();
      console.log("[worker] Redis disconnected");
    } catch {
      redis.disconnect();
    }

    console.log("[worker] Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

// ─── Entry Point ───────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("[worker] Fatal error:", err.message);
  process.exit(1);
});
