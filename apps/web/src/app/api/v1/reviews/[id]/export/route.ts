import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReviewJob, getReviewResult } from "@opr/db/queries";
import { exportReviewAsJson, exportReviewAsMarkdown, exportReviewAsPdf } from "@/lib/export";

const formatSchema = z.enum(["json", "markdown", "pdf"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  const parsed = formatSchema.safeParse(format);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid format. Must be one of: json, markdown, pdf" },
      { status: 400 }
    );
  }

  const job = await getReviewJob(db(), id);
  if (!job) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const result = await getReviewResult(db(), id);
  if (!result) {
    return NextResponse.json({ error: "Review not completed yet" }, { status: 404 });
  }

  const reviewData = {
    id,
    paperTitle: job.paperTitle ?? "Unknown Paper",
    venue: job.venueBundleId ?? "Unknown",
    overallScore: result.overallScore ?? 0,
    confidence: result.confidence ?? 0,
    summary: result.summary ?? "",
    strengths: result.strengths ?? [],
    weaknesses: result.majorIssues ?? [],
    questions: result.questions ?? [],
    suggestions: (result.improvements ?? []).map((i: any) => i.suggestion ?? i.description ?? ""),
  };

  switch (parsed.data) {
    case "json": {
      const data = exportReviewAsJson(reviewData);
      return NextResponse.json(data);
    }
    case "markdown": {
      const md = exportReviewAsMarkdown(reviewData);
      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="review-${id}.md"`,
        },
      });
    }
    case "pdf": {
      const pdfBuffer = await exportReviewAsPdf(reviewData);
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="review-${id}.pdf"`,
        },
      });
    }
  }
}
