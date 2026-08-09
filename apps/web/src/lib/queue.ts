import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const QUEUE_NAME = "review-jobs";

let connection: IORedis | null = null;
let queue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return queue;
}

export function getReviewQueue(): Queue {
  return getQueue();
}

export interface ReviewJobData {
  reviewId: string;
  paperId: string;
  venueId: string;
  language: "en" | "zh";
  modelProfileId?: string;
  userId: string;
}

/**
 * Enqueue a review job for processing by the worker.
 */
export async function enqueueReviewJob(data: ReviewJobData): Promise<string> {
  const q = getQueue();
  const job = await q.add("review", data, {
    jobId: data.reviewId,
  });
  return job.id!;
}

/**
 * Cancel a review job if it's still in the queue.
 */
export async function cancelReviewJob(reviewId: string): Promise<boolean> {
  const q = getQueue();
  const job = await q.getJob(reviewId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "waiting" || state === "delayed") {
    await job.remove();
    return true;
  }

  // For active jobs, we signal cancellation via a flag
  await job.updateData({ ...job.data, cancelled: true });
  return true;
}
