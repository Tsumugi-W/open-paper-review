import { eq, sql, desc } from "drizzle-orm";
import type { Database } from "../index.js";
import { reviewJobs, papers, venueBundles } from "../schema.js";

export async function createReviewJob(
  db: Database,
  data: {
    paperId: string;
    venueBundleId: string;
    language?: "en" | "zh";
    config?: unknown;
    createdBy: string;
  }
) {
  const [job] = await db.insert(reviewJobs).values(data).returning();
  return job;
}

export async function getReviewJob(db: Database, id: string) {
  const [row] = await db
    .select({
      job: reviewJobs,
      paperTitle: papers.title,
      venueBundleConference: venueBundles.conferenceId,
      venueBundleTrack: venueBundles.track,
      venueBundleYear: venueBundles.year,
    })
    .from(reviewJobs)
    .innerJoin(papers, eq(reviewJobs.paperId, papers.id))
    .innerJoin(venueBundles, eq(reviewJobs.venueBundleId, venueBundles.id))
    .where(eq(reviewJobs.id, id));

  if (!row) return null;

  return {
    ...row.job,
    paperTitle: row.paperTitle,
    venue: {
      conferenceId: row.venueBundleConference,
      track: row.venueBundleTrack,
      year: row.venueBundleYear,
    },
  };
}

export async function listReviewJobs(
  db: Database,
  opts: {
    page: number;
    limit: number;
    status?: "pending" | "gate" | "processing" | "completed" | "failed" | "cancelled";
  }
) {
  const { page, limit, status } = opts;
  const offset = (page - 1) * limit;

  const conditions = status ? eq(reviewJobs.status, status) : undefined;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewJobs)
    .where(conditions);

  const data = await db
    .select()
    .from(reviewJobs)
    .where(conditions)
    .orderBy(desc(reviewJobs.createdAt))
    .limit(limit)
    .offset(offset);

  return { data, total: totalResult.count };
}

export async function updateReviewJobStatus(
  db: Database,
  id: string,
  status: "pending" | "gate" | "processing" | "completed" | "failed" | "cancelled",
  extras?: {
    currentStage?: string | null;
    error?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
) {
  const updateData: Record<string, unknown> = { status };
  if (extras?.currentStage !== undefined) updateData.currentStage = extras.currentStage;
  if (extras?.error !== undefined) updateData.error = extras.error;
  if (extras?.startedAt !== undefined) updateData.startedAt = extras.startedAt;
  if (extras?.completedAt !== undefined) updateData.completedAt = extras.completedAt;

  await db.update(reviewJobs).set(updateData).where(eq(reviewJobs.id, id));
}

export async function cancelReviewJob(db: Database, id: string) {
  await db
    .update(reviewJobs)
    .set({ status: "cancelled" })
    .where(eq(reviewJobs.id, id));
}
