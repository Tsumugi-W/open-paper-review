import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPaper, getPaperByHash } from "@opr/db/queries";
import { downloadArxivPaper } from "@/lib/arxiv";
import { saveFile } from "@/lib/storage";
import { createHash } from "crypto";

const arxivSchema = z.object({
  arxivId: z.string().regex(/^\d{4}\.\d{4,5}(v\d+)?$/, "Invalid arXiv ID format"),
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

  const parsed = arxivSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { arxivId } = parsed.data;

  try {
    const { buffer, metadata } = await downloadArxivPaper(arxivId);
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    const existing = await getPaperByHash(db(), fileHash);
    if (existing) {
      return NextResponse.json(
        { error: "This paper has already been imported", existingId: existing.id },
        { status: 409 }
      );
    }

    const paperId = crypto.randomUUID();
    const filePath = await saveFile(`papers/${paperId}/original.pdf`, buffer);

    const paper = await createPaper(db(), {
      title: metadata.title,
      authors: metadata.authors,
      abstract: metadata.abstract,
      arxivId,
      fileHash,
      filePath,
      pageCount: 0,
      fileSize: buffer.length,
      uploadedById: session.userId,
      metadata: {
        arxivVersion: arxivId.includes("v") ? arxivId.split("v")[1] : "1",
        downloadedAt: new Date().toISOString(),
        publishedDate: metadata.publishedDate,
      },
    });

    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download paper";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
