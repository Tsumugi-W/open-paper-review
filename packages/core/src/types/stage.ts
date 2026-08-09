import type { EvidenceRef } from "./evidence.js";
import type { ReviewStage } from "./workflow.js";

// ─── Stage Output ────────────────────────────────────────────────────────────

export interface StageOutput<T = unknown> {
  stage: ReviewStage;
  promptVersion: string;
  model: string;
  result: T;
  evidence: EvidenceRef[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
