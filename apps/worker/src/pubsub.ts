/**
 * Redis pub/sub utilities for SSE event streaming.
 * Publishes orchestrator events to Redis channels for real-time SSE consumption.
 */

import type { Redis } from "ioredis";

// ─── Channel Naming ───────────────────────────────────────────────────────────

/**
 * Returns the Redis channel name for a given job's review events.
 */
export function reviewChannel(jobId: string): string {
  return `review:${jobId}:events`;
}

// ─── Event Types ──────────────────────────────────────────────────────────────

export interface ReviewEvent {
  type:
    | "stage_start"
    | "stage_complete"
    | "progress"
    | "error"
    | "completed"
    | "cancelled";
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

// ─── Publish ──────────────────────────────────────────────────────────────────

/**
 * Publishes a review event to the Redis pub/sub channel for the given job.
 * This is consumed by SSE endpoints in the web app.
 */
export async function publishEvent(
  redis: Redis,
  jobId: string,
  event: ReviewEvent,
): Promise<void> {
  try {
    await redis.publish(reviewChannel(jobId), JSON.stringify(event));
  } catch {
    // Do not let Redis pub/sub errors crash the worker
    console.error(`[pubsub] Failed to publish event for job ${jobId}`);
  }
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

/**
 * Subscribes to review events for a specific job.
 * The callback is invoked for each event received on the channel.
 *
 * Returns an unsubscribe function that cleans up the subscription.
 *
 * NOTE: The subscriber Redis client must be a dedicated instance -
 * a Redis client in subscriber mode cannot be used for other commands.
 */
export async function subscribeToJob(
  redis: Redis,
  jobId: string,
  callback: (event: ReviewEvent) => void,
): Promise<() => Promise<void>> {
  const channel = reviewChannel(jobId);

  const messageHandler = (ch: string, message: string) => {
    if (ch !== channel) return;
    try {
      const event = JSON.parse(message) as ReviewEvent;
      callback(event);
    } catch {
      console.error(`[pubsub] Failed to parse event on channel ${channel}`);
    }
  };

  redis.on("message", messageHandler);
  await redis.subscribe(channel);

  // Return unsubscribe function
  return async () => {
    redis.off("message", messageHandler);
    await redis.unsubscribe(channel);
  };
}
