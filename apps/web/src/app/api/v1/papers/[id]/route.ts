import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPaperById, deletePaper } from "@opr/db/queries";
import { deleteFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const paper = await getPaperById(db(), id);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json(paper);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const paper = await getPaperById(db(), id);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Only uploader or admin can delete
  if (session.role !== 'admin' && paper.uploadedById !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await deletePaper(db(), id);

  // Delete storage files
  if (result?.filePaths) {
    for (const filePath of result.filePaths) {
      await deleteFile(filePath).catch(() => {});
    }
  }

  return NextResponse.json({ deleted: true, id });
}
