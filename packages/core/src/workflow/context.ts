/**
 * ReviewContext accumulates data through the review pipeline.
 * Each stage reads from prior stage outputs and writes its own results.
 */

import type { WorkflowTokenUsage } from "./types.js";
import type { VenueBundle, ScoreScale, PrecheckRule } from "../types/venue.js";
import type { EvidenceRef } from "../types/evidence.js";
import type {
  GateResult,
  PaperBriefing,
  RelatedWorkResult,
  SpecialistAudit,
  ScorePrior,
  ScoreCandidate,
  CandidateSelection,
  SynthesisResult,
  CalibrationResult,
  ImprovementsResult,
} from "../schemas/index.js";

// ─── Paper Artifacts ────────────────────────────────────────────────────────

export interface PaperPage {
  pageNumber: number;
  text: string;
  imagePath?: string;
}

export interface PaperChunk {
  chunkIndex: number;
  sectionTitle?: string;
  content: string;
  startPage: number;
  endPage: number;
}

export interface PaperFigure {
  id: string;
  pageNumber: number;
  caption: string;
  imagePath?: string;
}

export interface PaperArtifacts {
  /** Full text content of the paper. */
  fullText: string;
  /** Individual pages with text content. */
  pages: PaperPage[];
  /** Semantic chunks for targeted analysis. */
  chunks: PaperChunk[];
  /** Extracted figures with captions. */
  figures: PaperFigure[];
  /** Page count. */
  pageCount: number;
  /** Base64-encoded PDF data for provider calls. */
  pdfData?: string;
  /** Remote artifact IDs for cleanup (e.g., uploaded files). */
  remoteArtifactIds: string[];
}

// ─── Venue Bundle (subset for context) ──────────────────────────────────────

export interface VenueContext {
  venueId: string;
  conferenceId: string;
  track: string;
  year: number;
  scoreScale: ScoreScale;
  precheckRules: PrecheckRule[];
  rubric: VenueBundle;
}

// ─── Provider Usage Record ──────────────────────────────────────────────────

export interface UsageRecord {
  stage: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  timestamp: string;
}

// ─── Gate Confirmation ──────────────────────────────────────────────────────

export interface GateConfirmation {
  confirmedAt: string;
  confirmedBy: string;
  overriddenFindings: string[];
}

// ─── Review Context ─────────────────────────────────────────────────────────

export interface ReviewContext {
  // ─── Identifiers ────────────────────────────────────────────────────
  jobId: string;
  paperId: string;

  // ─── Paper artifacts (set during intake) ────────────────────────────
  paper?: PaperArtifacts;

  // ─── Venue bundle (loaded at start) ────────────────────────────────
  venue?: VenueContext;

  // ─── Stage outputs (each set after its stage completes) ─────────────
  gateResult?: GateResult;
  gateConfirmation?: GateConfirmation;
  briefing?: PaperBriefing;
  relatedWork?: RelatedWorkResult;
  specialistAudits?: SpecialistAudit[];
  scorePrior?: ScorePrior;
  scoreCandidates?: ScoreCandidate[];
  candidateSelection?: CandidateSelection;
  synthesis?: SynthesisResult;
  calibration?: CalibrationResult;
  improvements?: ImprovementsResult;

  // ─── Final result ──────────────────────────────────────────────────
  finalResult?: SynthesisResult & {
    calibration: CalibrationResult;
    improvements: ImprovementsResult;
  };

  // ─── Provider usage tracking ───────────────────────────────────────
  usageRecords: UsageRecord[];

  // ─── Cumulative totals ─────────────────────────────────────────────
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a fresh ReviewContext for a new job.
 */
export function createReviewContext(
  jobId: string,
  paperId: string,
): ReviewContext {
  return {
    jobId,
    paperId,
    usageRecords: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalDurationMs: 0,
  };
}

// ─── Usage Helpers ──────────────────────────────────────────────────────────

/**
 * Record a provider usage entry and update cumulative totals.
 */
export function recordUsage(
  context: ReviewContext,
  record: UsageRecord,
): void {
  context.usageRecords.push(record);
  context.totalInputTokens += record.inputTokens;
  context.totalOutputTokens += record.outputTokens;
  context.totalCostUsd += record.costUsd;
  context.totalDurationMs += record.durationMs;
}

/**
 * Convert provider TokenUsage to a partial UsageRecord.
 */
export function tokenUsageToRecord(
  stage: string,
  provider: string,
  model: string,
  usage: WorkflowTokenUsage,
  costUsd: number,
  durationMs: number,
): UsageRecord {
  return {
    stage,
    provider,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    costUsd,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}
