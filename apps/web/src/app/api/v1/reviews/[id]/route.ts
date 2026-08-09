import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReviewJob, getReviewResult, getUsageByJob } from "@opr/db/queries";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getReviewJob(db(), id);

  if (!job) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const result = job.status === "completed" ? await getReviewResult(db(), id) : null;
  const usage = await getUsageByJob(db(), id);

  return NextResponse.json({
    ...job,
    result,
    usage: {
      totalInputTokens: usage.reduce((sum: number, u: any) => sum + (u.inputTokens ?? 0), 0),
      totalOutputTokens: usage.reduce((sum: number, u: any) => sum + (u.outputTokens ?? 0), 0),
      totalCostUsd: usage.reduce((sum: number, u: any) => sum + Number(u.costUsd ?? 0), 0),
      stages: usage,
    },
  });
}
