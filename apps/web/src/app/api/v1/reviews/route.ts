import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReviewJob, getPaperById } from "@opr/db/queries";
import { enqueueReviewJob } from "@/lib/queue";
import { CostEstimator } from "@opr/core";

const createReviewSchema = z.object({
  paperId: z.string().uuid("Invalid paper ID"),
  venueBundleId: z.string().min(1, "Venue is required"),
  language: z.enum(["en", "zh"]).default("en"),
});

export async function POST(request: NextRequest) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { paperId, venueBundleId, language } = parsed.data;

  const paper = await getPaperById(db(), paperId);
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const job = await createReviewJob(db(), {
    paperId,
    venueBundleId,
    language,
    config: {},
    createdBy: session.userId,
  });

  await enqueueReviewJob({
    reviewId: job.id,
    paperId,
    venueId: venueBundleId,
    language,
    userId: session.userId,
  });

  const estimator = new CostEstimator();
  const costEstimate = estimator.estimate({
    pageCount: paper.pageCount || 10,
    scoreScaleSize: 10,
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  });

  return NextResponse.json({ ...job, costEstimate }, { status: 201 });
}
