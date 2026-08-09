import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '@opr/db';
import * as queries from '@opr/db/queries';

const TEST_DB_URL = process.env.DATABASE_URL;

describe.skipIf(!TEST_DB_URL)('Database Cascade Deletes', () => {
  let db: ReturnType<typeof getDb>;
  let userId: string;
  let paperId: string;
  let reviewJobId: string;

  beforeAll(async () => {
    db = getDb();

    // Create test user
    const user = await queries.createUser(db, {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      passwordHash: 'fake-hash',
      role: 'admin',
    });
    userId = user.id;

    // Create test paper
    const paper = await queries.createPaper(db, {
      title: 'Test Paper for Cascade',
      authors: ['Author A'],
      abstract: 'Test abstract',
      arxivId: null,
      fileHash: `hash-${Date.now()}`,
      filePath: '/tmp/test.pdf',
      pageCount: 5,
      fileSize: 1000000,
      uploadedById: userId,
      metadata: {},
    });
    paperId = paper.id;

    // Create paper pages
    await queries.createPaperPages(db, paperId, [
      { pageNumber: 1, textContent: 'Page 1 content', ocrContent: null, imagePath: '', coordinates: {} },
      { pageNumber: 2, textContent: 'Page 2 content', ocrContent: null, imagePath: '', coordinates: {} },
    ]);

    // Create paper chunks
    await queries.createPaperChunks(db, paperId, [
      { chunkIndex: 0, sectionTitle: 'Introduction', content: 'Intro text', startPage: 1, endPage: 1 },
    ]);

    // Create references
    await queries.createReferences(db, paperId, [
      { refIndex: 0, rawText: '[1] Some paper', title: 'Some paper', authors: [], year: 2023, doi: null },
    ]);

    // Create review job
    const job = await queries.createReviewJob(db, {
      paperId,
      venueBundleId: 'neurips/main/2026/v1',
      language: 'en',
      config: {},
      createdBy: userId,
    });
    reviewJobId = job.id;

    // Create job events
    await queries.createJobEvent(db, {
      reviewJobId,
      stage: 'intake',
      type: 'stage_start',
      message: 'Starting intake',
      data: {},
    });
  });

  afterAll(async () => {
    // Cleanup is handled by cascade delete test
  });

  it('deleting a paper cascades to all related records', async () => {
    const result = await queries.deletePaper(db, paperId);
    expect(result).toBeDefined();

    // Verify paper is gone
    const paper = await queries.getPaperById(db, paperId);
    expect(paper).toBeNull();

    // Verify pages are gone
    const pages = await queries.getPaperPages(db, paperId);
    expect(pages.length).toBe(0);

    // Verify chunks are gone
    const chunks = await queries.getPaperChunks(db, paperId);
    expect(chunks.length).toBe(0);

    // Verify references are gone
    const refs = await queries.getPaperReferences(db, paperId);
    expect(refs.length).toBe(0);
  });

  it('user deletion is blocked when papers exist', async () => {
    // Create another paper to test user deletion block
    const paper = await queries.createPaper(db, {
      title: 'Block Delete Test',
      authors: [],
      abstract: '',
      arxivId: null,
      fileHash: `hash-block-${Date.now()}`,
      filePath: '/tmp/block.pdf',
      pageCount: 1,
      fileSize: 100,
      uploadedById: userId,
      metadata: {},
    });

    await expect(queries.deleteUser(db, userId)).rejects.toThrow();

    // Clean up
    await queries.deletePaper(db, paper.id);
    await queries.deleteUser(db, userId);
  });
});
