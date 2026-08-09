import { eq } from "drizzle-orm";
import type { Database } from "../index.js";
import {
  gateFindings,
  specialistAudits,
  scoreCandidates,
  reviewResults,
} from "../schema.js";

export async function saveGateFindings(
  db: Database,
  reviewJobId: string,
  findings: Array<{
    type: "hard_stop" | "needs_confirmation";
    category: string;
    message: string;
    evidence?: unknown;
    pageNumbers?: number[] | null;
    resolved?: boolean;
  }>
) {
  if (findings.length === 0) return;
  await db
    .insert(gateFindings)
    .values(findings.map((f) => ({ ...f, reviewJobId })));
}

export async function saveSpecialistAudits(
  db: Database,
  reviewJobId: string,
  audits: Array<{
    dimension: "methodology" | "novelty" | "experiments" | "writing" | "ethics";
    findings: unknown;
    promptVersion?: string | null;
    modelUsed?: string | null;
    durationMs?: number | null;
  }>
) {
  if (audits.length === 0) return;
  await db
    .insert(specialistAudits)
    .values(audits.map((a) => ({ ...a, reviewJobId })));
}

export async function saveScoreCandidates(
  db: Database,
  reviewJobId: string,
  candidates: Array<{
    score: number;
    rationale: string;
    strengths?: unknown;
    weaknesses?: unknown;
    evidence?: unknown;
    confidence?: string | null;
    promptVersion?: string | null;
    modelUsed?: string | null;
  }>
) {
  if (candidates.length === 0) return;
  await db
    .insert(scoreCandidates)
    .values(candidates.map((c) => ({ ...c, reviewJobId })));
}

export async function saveReviewResult(
  db: Database,
  reviewJobId: string,
  result: {
    overallScore: number;
    confidence: string;
    summary: string;
    strengths: unknown;
    majorIssues: unknown;
    minorIssues: unknown;
    questions?: unknown;
    mainReview: string;
    optimisticView?: string | null;
    criticalView?: string | null;
    improvements?: unknown;
    calibration?: unknown;
    promptVersions?: unknown;
  }
) {
  const [reviewResult] = await db
    .insert(reviewResults)
    .values({ ...result, reviewJobId })
    .returning();
  return reviewResult;
}

export async function getReviewResult(db: Database, reviewJobId: string) {
  const [result] = await db
    .select()
    .from(reviewResults)
    .where(eq(reviewResults.reviewJobId, reviewJobId));
  return result ?? null;
}
