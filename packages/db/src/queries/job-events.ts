import { eq, and, gt, desc } from "drizzle-orm";
import type { Database } from "../index.js";
import { jobEvents } from "../schema.js";

export async function createJobEvent(
  db: Database,
  data: {
    reviewJobId: string;
    stage: string;
    type: "stage_start" | "stage_complete" | "stage_error" | "progress" | "info";
    message?: string | null;
    data?: unknown;
  }
) {
  const [event] = await db.insert(jobEvents).values(data).returning();
  return event;
}

export async function getJobEvents(
  db: Database,
  reviewJobId: string,
  opts?: { limit?: number; after?: string }
) {
  const conditions = [eq(jobEvents.reviewJobId, reviewJobId)];

  if (opts?.after) {
    conditions.push(gt(jobEvents.id, opts.after));
  }

  return db
    .select()
    .from(jobEvents)
    .where(and(...conditions))
    .orderBy(desc(jobEvents.createdAt))
    .limit(opts?.limit ?? 1000);
}
