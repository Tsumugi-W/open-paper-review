/**
 * Event publisher for orchestrator events.
 * Listens to orchestrator event emissions and:
 * 1. Saves events to the jobEvents table in the database
 * 2. Publishes events to a Redis pub/sub channel for SSE consumers
 */

import type { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import { getDb, jobEvents } from "@opr/db";
import type { OrchestratorEvents } from "@opr/core/workflow";

// ─── Channel Naming ────────────────────────────────────────────────────────

function jobChannel(jobId: string): string {
  return `review:${jobId}:events`;
}

// ─── Event Payload ─────────────────────────────────────────────────────────

interface PublishedEvent {
  type: keyof OrchestratorEvents;
  jobId: string;
  stage?: string;
  timestamp: string;
  message: string;
  percent?: number;
  durationMs?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─── Event Publisher ───────────────────────────────────────────────────────

/**
 * Wire up orchestrator events to DB persistence and Redis pub/sub.
 * Call this after creating the orchestrator and before executing.
 */
export function attachEventPublisher(
  emitter: EventEmitter,
  redis: Redis,
): void {
  emitter.on("stage_start", (data: OrchestratorEvents["stage_start"]) => {
    void handleStageStart(data, redis);
  });

  emitter.on("stage_complete", (data: OrchestratorEvents["stage_complete"]) => {
    void handleStageComplete(data, redis);
  });

  emitter.on("progress", (data: OrchestratorEvents["progress"]) => {
    void handleProgress(data, redis);
  });

  emitter.on("error", (data: OrchestratorEvents["error"]) => {
    void handleError(data, redis);
  });

  emitter.on("completed", (data: OrchestratorEvents["completed"]) => {
    void handleCompleted(data, redis);
  });

  emitter.on("cancelled", (data: OrchestratorEvents["cancelled"]) => {
    void handleCancelled(data, redis);
  });
}

// ─── Event Handlers ────────────────────────────────────────────────────────

async function handleStageStart(
  data: OrchestratorEvents["stage_start"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "stage_start",
    jobId: data.jobId,
    stage: data.stage,
    timestamp: data.timestamp,
    message: `Stage started: ${data.stage}`,
  };

  await saveEvent(data.jobId, data.stage, "stage_start", event.message);
  await publishEvent(redis, data.jobId, event);
}

async function handleStageComplete(
  data: OrchestratorEvents["stage_complete"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "stage_complete",
    jobId: data.jobId,
    stage: data.stage,
    timestamp: data.timestamp,
    message: `Stage completed: ${data.stage}`,
    durationMs: data.durationMs,
  };

  await saveEvent(data.jobId, data.stage, "stage_complete", event.message, {
    durationMs: data.durationMs,
  });
  await publishEvent(redis, data.jobId, event);
}

async function handleProgress(
  data: OrchestratorEvents["progress"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "progress",
    jobId: data.jobId,
    stage: data.stage,
    timestamp: new Date().toISOString(),
    message: data.message,
    percent: data.percent,
  };

  await saveEvent(data.jobId, data.stage, "progress", data.message, {
    percent: data.percent,
  });
  await publishEvent(redis, data.jobId, event);
}

async function handleError(
  data: OrchestratorEvents["error"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "error",
    jobId: data.jobId,
    stage: data.stage,
    timestamp: new Date().toISOString(),
    message: `Stage error: ${data.stage}`,
  };

  await saveEvent(data.jobId, data.stage, "stage_error", data.error);
  await publishEvent(redis, data.jobId, event);
}

async function handleCompleted(
  data: OrchestratorEvents["completed"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "completed",
    jobId: data.jobId,
    timestamp: data.timestamp,
    message: "Review completed",
    durationMs: data.totalDurationMs,
  };

  await saveEvent(data.jobId, "completed", "info", event.message, {
    totalDurationMs: data.totalDurationMs,
  });
  await publishEvent(redis, data.jobId, event);
}

async function handleCancelled(
  data: OrchestratorEvents["cancelled"],
  redis: Redis,
): Promise<void> {
  const event: PublishedEvent = {
    type: "cancelled",
    jobId: data.jobId,
    timestamp: data.timestamp,
    message: "Review cancelled",
  };

  await saveEvent(data.jobId, "cancelled", "info", event.message);
  await publishEvent(redis, data.jobId, event);
}

// ─── Persistence ───────────────────────────────────────────────────────────

async function saveEvent(
  reviewJobId: string,
  stage: string,
  type: "stage_start" | "stage_complete" | "stage_error" | "progress" | "info",
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(jobEvents).values({
      reviewJobId,
      stage,
      type,
      message,
      data: data ?? null,
    });
  } catch {
    // Do not let DB errors crash the worker - log without paper content
    console.error(`[worker] Failed to save event for job ${reviewJobId}`);
  }
}

// ─── Redis Pub/Sub ─────────────────────────────────────────────────────────

async function publishEvent(
  redis: Redis,
  jobId: string,
  event: PublishedEvent,
): Promise<void> {
  try {
    await redis.publish(jobChannel(jobId), JSON.stringify(event));
  } catch {
    // Do not let Redis errors crash the worker
    console.error(`[worker] Failed to publish event for job ${jobId}`);
  }
}
