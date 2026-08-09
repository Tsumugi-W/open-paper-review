import { eq, sql, ilike, or, desc } from "drizzle-orm";
import type { Database } from "../index.js";
import {
  papers,
  paperPages,
  paperChunks,
  references,
  reviewJobs,
  reviewResults,
  exports_,
  providerUsage,
  jobEvents,
  gateFindings,
  specialistAudits,
  scoreCandidates,
  annotations,
} from "../schema.js";

export async function createPaper(
  db: Database,
  data: {
    title: string;
    authors: unknown;
    abstract?: string | null;
    arxivId?: string | null;
    fileHash: string;
    filePath: string;
    pageCount?: number | null;
    fileSize?: number | null;
    uploadedById: string;
    metadata?: unknown;
  }
) {
  const [paper] = await db.insert(papers).values(data).returning();
  return paper;
}

export async function getPaperById(db: Database, id: string) {
  const [paper] = await db.select().from(papers).where(eq(papers.id, id));
  if (!paper) return null;

  const [pageCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paperPages)
    .where(eq(paperPages.paperId, id));

  return { ...paper, pagesCount: pageCountResult.count };
}

export async function listPapers(
  db: Database,
  opts: { page: number; limit: number; search?: string }
) {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = search
    ? or(
        ilike(papers.title, `%${search}%`),
        ilike(papers.abstract, `%${search}%`)
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(papers)
    .where(conditions);

  const data = await db
    .select()
    .from(papers)
    .where(conditions)
    .orderBy(desc(papers.createdAt))
    .limit(limit)
    .offset(offset);

  return { data, total: totalResult.count };
}

export async function deletePaper(db: Database, id: string) {
  // Gather file paths that need to be deleted from storage
  const pageImages = await db
    .select({ imagePath: paperPages.imagePath })
    .from(paperPages)
    .where(eq(paperPages.paperId, id));

  const [paper] = await db
    .select({ filePath: papers.filePath })
    .from(papers)
    .where(eq(papers.id, id));

  // Get export file paths via review results
  const jobIds = await db
    .select({ id: reviewJobs.id })
    .from(reviewJobs)
    .where(eq(reviewJobs.paperId, id));

  let exportPaths: string[] = [];
  if (jobIds.length > 0) {
    const resultIds = await db
      .select({ id: reviewResults.id })
      .from(reviewResults)
      .where(
        sql`${reviewResults.reviewJobId} IN (${sql.join(
          jobIds.map((j) => sql`${j.id}`),
          sql`, `
        )})`
      );

    if (resultIds.length > 0) {
      const exportRows = await db
        .select({ filePath: exports_.filePath })
        .from(exports_)
        .where(
          sql`${exports_.reviewResultId} IN (${sql.join(
            resultIds.map((r) => sql`${r.id}`),
            sql`, `
          )})`
        );
      exportPaths = exportRows.map((e) => e.filePath);
    }
  }

  // Cascade delete - the schema has onDelete: "cascade" for most relations
  // but we delete in a transaction to be safe
  await db.transaction(async (tx) => {
    await tx.delete(papers).where(eq(papers.id, id));
  });

  // Collect all file paths that the caller should delete from storage
  const filePaths: string[] = [];
  if (paper?.filePath) filePaths.push(paper.filePath);
  for (const page of pageImages) {
    if (page.imagePath) filePaths.push(page.imagePath);
  }
  filePaths.push(...exportPaths);

  return filePaths;
}

export async function getPaperByHash(db: Database, fileHash: string) {
  const [paper] = await db
    .select()
    .from(papers)
    .where(eq(papers.fileHash, fileHash));
  return paper ?? null;
}
