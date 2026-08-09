import { eq, asc } from "drizzle-orm";
import type { Database } from "../index.js";
import { paperPages, paperChunks, references } from "../schema.js";

export async function createPaperPages(
  db: Database,
  paperId: string,
  pages: Array<{
    pageNumber: number;
    textContent?: string | null;
    ocrContent?: string | null;
    imagePath?: string | null;
    coordinates?: unknown;
  }>
) {
  if (pages.length === 0) return;
  await db
    .insert(paperPages)
    .values(pages.map((p) => ({ ...p, paperId })));
}

export async function createPaperChunks(
  db: Database,
  paperId: string,
  chunks: Array<{
    pageId: string;
    chunkIndex: number;
    sectionTitle?: string | null;
    content: string;
    startPage: number;
    endPage: number;
  }>
) {
  if (chunks.length === 0) return;
  await db
    .insert(paperChunks)
    .values(chunks.map((c) => ({ ...c, paperId })));
}

export async function createReferences(
  db: Database,
  paperId: string,
  refs: Array<{
    refIndex: number;
    rawText: string;
    title?: string | null;
    authors?: string | null;
    year?: number | null;
    doi?: string | null;
    openAlexId?: string | null;
    semanticScholarId?: string | null;
    verified?: boolean;
  }>
) {
  if (refs.length === 0) return;
  await db
    .insert(references)
    .values(refs.map((r) => ({ ...r, paperId })));
}

export async function getPaperPages(db: Database, paperId: string) {
  return db
    .select()
    .from(paperPages)
    .where(eq(paperPages.paperId, paperId))
    .orderBy(asc(paperPages.pageNumber));
}

export async function getPaperChunks(db: Database, paperId: string) {
  return db
    .select()
    .from(paperChunks)
    .where(eq(paperChunks.paperId, paperId))
    .orderBy(asc(paperChunks.chunkIndex));
}

export async function getPaperReferences(db: Database, paperId: string) {
  return db
    .select()
    .from(references)
    .where(eq(references.paperId, paperId))
    .orderBy(asc(references.refIndex));
}
