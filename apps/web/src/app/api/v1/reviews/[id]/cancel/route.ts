import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReviewJob, cancelReviewJob } from "@opr/db/queries";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getReviewJob(db(), id);

  if (!job) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    return NextResponse.json(
      { error: `Cannot cancel: review is already ${job.status}` },
      { status: 409 }
    );
  }

  await cancelReviewJob(db(), id);

  return NextResponse.json({
    id,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  });
}
