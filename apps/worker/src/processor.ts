/**
 * Job processor for BullMQ worker.
 * Receives review jobs from the queue and executes the multi-agent review pipeline.
 */

import { EventEmitter } from "node:events";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import {
  ReviewOrchestrator,
  type JobPersistence,
  type MachineSnapshot,
  type ReviewContext,
  MachineState,
  type WorkflowProvider,
} from "@opr/core/workflow";
import type { VenueBundle } from "@opr/core";
import { getDb, reviewJobs, jobEvents } from "@opr/db";
import { eq } from "drizzle-orm";

import { attachEventPublisher } from "./events.js";
import { finalCleanup, trackArtifact } from "./cleanup.js";

// ─── Job Data Types ────────────────────────────────────────────────────────

export interface ReviewJobData {
  jobId: string;
  paperId: string;
  venueBundleId: string;
  language: "en" | "zh";
  config?: Record<string, unknown>;
}

export interface ReviewJobResult {
  jobId: string;
  status: "completed" | "failed" | "cancelled";
  durationMs: number;
}

// ─── Processor Dependencies ────────────────────────────────────────────────

export interface ProcessorDeps {
  redis: Redis;
  createProvider: (config?: Record<string, unknown>) => WorkflowProvider;
  loadVenueBundle: (venueBundleId: string) => Promise<VenueBundle>;
}

// ─── Create Processor ──────────────────────────────────────────────────────

/**
 * Creates the job processor function used by the BullMQ worker.
 */
export function createProcessor(deps: ProcessorDeps) {
  return async function processJob(
    job: Job<ReviewJobData, ReviewJobResult>,
  ): Promise<ReviewJobResult> {
    const { jobId, paperId, venueBundleId, config } = job.data;
    const startTime = Date.now();

    // Create an AbortController that respects the job's cancellation token
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Listen to BullMQ job signal for cancellation
    if (job.token) {
      // BullMQ provides a way to detect job cancellation
      const checkCancellation = async () => {
        try {
          const isCancelled = await job.isFailed();
          if (isCancelled) {
            abortController.abort();
          }
        } catch {
          // Ignore check errors
        }
      };

      // Periodic cancellation check
      const cancelInterval = setInterval(checkCancellation, 5000);
      signal.addEventListener("abort", () => clearInterval(cancelInterval));
    }

    // Create provider instance
    const provider = deps.createProvider(config);

    try {
      // Mark job as processing
      const db = getDb();
      await db
        .update(reviewJobs)
        .set({
          status: "processing",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, jobId));

      // Create persistence adapter
      const persistence = createPersistence(jobId);

      // Create event emitter and attach publisher
      const emitter = new EventEmitter();
      attachEventPublisher(emitter, deps.redis);

      // Create orchestrator
      const orchestrator = new ReviewOrchestrator({
        provider,
        persistence,
        emitter,
      });

      // Determine if this is a fresh execution or a resume
      const existingState = await persistence.loadJobState(jobId);

      if (existingState && !isTerminalState(existingState.machineSnapshot.currentState)) {
        // Resume from last committed stage
        await orchestrator.resume(jobId, signal);
      } else if (!existingState) {
        // Fresh execution - load venue bundle
        const venueBundle = await deps.loadVenueBundle(venueBundleId);
        await orchestrator.execute(jobId, paperId, venueBundle, signal);
      }

      // Mark completed
      const durationMs = Date.now() - startTime;
      await db
        .update(reviewJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, jobId));

      return { jobId, status: "completed", durationMs };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;

      if (signal.aborted) {
        // Cancelled
        return { jobId, status: "cancelled", durationMs };
      }

      // Record failure
      try {
        const db = getDb();
        await db
          .update(reviewJobs)
          .set({
            status: "failed",
            error: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(reviewJobs.id, jobId));
      } catch {
        console.error(`[worker] Failed to record error state for job ${jobId}`);
      }

      // Record error event without paper content
      try {
        const db = getDb();
        await db.insert(jobEvents).values({
          reviewJobId: jobId,
          stage: "processor",
          type: "stage_error",
          message: errorMessage,
        });
      } catch {
        console.error(`[worker] Failed to record error event for job ${jobId}`);
      }

      return { jobId, status: "failed", durationMs };
    } finally {
      // Always clean up provider artifacts
      await finalCleanup(jobId, provider);
    }
  };
}

// ─── Persistence Adapter ───────────────────────────────────────────────────

/**
 * Creates a JobPersistence implementation backed by the database.
 */
function createPersistence(jobId: string): JobPersistence {
  return {
    async loadJobState(id: string) {
      // In a full implementation, this would load the machine snapshot,
      // context, and venue bundle from the database.
      // For now, the orchestrator manages its own state within a single execution.
      // Resume is supported by loading the saved snapshot from a job metadata store.
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      if (!job || !job.config) return null;

      const savedState = (job.config as Record<string, unknown>).__machineSnapshot as MachineSnapshot | undefined;
      if (!savedState) return null;

      const context = (job.config as Record<string, unknown>).__context as ReviewContext | undefined;
      const venueBundle = (job.config as Record<string, unknown>).__venueBundle as import("@opr/core").VenueBundle | undefined;

      if (!context || !venueBundle) return null;

      return {
        machineSnapshot: savedState,
        context,
        venueBundle,
      };
    },

    async saveMachineSnapshot(id: string, snapshot: MachineSnapshot) {
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      const existingConfig = (job?.config as Record<string, unknown>) ?? {};

      await db
        .update(reviewJobs)
        .set({
          currentStage: snapshot.currentState,
          config: { ...existingConfig, __machineSnapshot: snapshot },
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, id));
    },

    async saveStageOutput(id: string, stage: MachineState, output) {
      const db = getDb();
      await db.insert(jobEvents).values({
        reviewJobId: id,
        stage,
        type: "stage_complete",
        message: `Stage output saved: ${stage}`,
        data: {
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          costUsd: output.costUsd,
          model: output.model,
        },
      });
    },

    async saveContext(id: string, context: ReviewContext) {
      const db = getDb();
      const job = await db.query.reviewJobs.findFirst({
        where: eq(reviewJobs.id, id),
      });

      const existingConfig = (job?.config as Record<string, unknown>) ?? {};

      await db
        .update(reviewJobs)
        .set({
          config: { ...existingConfig, __context: context },
          updatedAt: new Date(),
        })
        .where(eq(reviewJobs.id, id));
    },

    async logEvent(id, type, stage, message, data) {
      const db = getDb();
      await db.insert(jobEvents).values({
        reviewJobId: id,
        stage,
        type,
        message,
        data: data ?? null,
      });
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isTerminalState(state: string): boolean {
  return (
    state === MachineState.Completed ||
    state === MachineState.Failed ||
    state === MachineState.Cancelled
  );
}
