import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPaper, listPapers, getPaperByHash } from "@opr/db/queries";
import { saveFile } from "@/lib/storage";
import { createHash } from "crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MiB

export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
  const search = searchParams.get("search") ?? undefined;

  const result = await listPapers(db(), { page, limit, search });

  return NextResponse.json({
    data: result.data,
    pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) },
  });
}

const uploadSchema = z.object({
  title: z.string().min(1).max(500),
  authors: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;
  const authors = formData.get("authors") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MiB limit` },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  let parsedAuthors: string[] = [];
  if (authors) {
    try { parsedAuthors = JSON.parse(authors); } catch { /* ignore */ }
  }

  const metadata = uploadSchema.safeParse({
    title: title ?? file.name.replace(/\.pdf$/i, ""),
    authors: parsedAuthors,
  });

  if (!metadata.success) {
    return NextResponse.json(
      { error: "Invalid metadata", details: metadata.error.issues },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash('sha256').update(buffer).digest('hex');

  // Dedup check
  const existing = await getPaperByHash(db(), fileHash);
  if (existing) {
    return NextResponse.json(
      { error: "This paper has already been uploaded", existingId: existing.id },
      { status: 409 }
    );
  }

  const paperId = crypto.randomUUID();
  const filePath = await saveFile(`papers/${paperId}/original.pdf`, buffer);

  const paper = await createPaper(db(), {
    title: metadata.data.title,
    authors: metadata.data.authors,
    abstract: '',
    arxivId: null,
    fileHash,
    filePath,
    pageCount: 0, // Will be updated after PDF processing
    fileSize: buffer.length,
    uploadedById: session.userId,
    metadata: {},
  });

  return NextResponse.json(paper, { status: 201 });
}
