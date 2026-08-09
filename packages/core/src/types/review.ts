import type { EvidenceRef } from "./evidence.js";

// ─── Issue Types ─────────────────────────────────────────────────────────────

export interface ReviewIssue {
  id: string;
  category: string;
  description: string;
  severity: "critical" | "major" | "minor";
  evidence: EvidenceRef[];
  suggestion?: string;
}

// ─── Strength ────────────────────────────────────────────────────────────────

export interface ReviewStrength {
  id: string;
  category: string;
  description: string;
  evidence: EvidenceRef[];
}

// ─── Question for Authors ────────────────────────────────────────────────────

export interface ReviewQuestion {
  id: string;
  question: string;
  context: string;
  priority: "high" | "medium" | "low";
}

// ─── Improvement Suggestion ──────────────────────────────────────────────────

export interface ImprovementItem {
  id: string;
  area: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  expectedImpact?: string;
  evidence?: EvidenceRef[];
}

// ─── Calibration Info ────────────────────────────────────────────────────────

export interface CalibrationInfo {
  venueId: string;
  originalScore: number;
  calibratedScore: number;
  historicalMean: number;
  historicalStdDev: number;
  adjustmentApplied: number;
  percentile: number;
  rationale: string;
}

// ─── Review Result ───────────────────────────────────────────────────────────

export interface ReviewResult {
  overallScore: number;
  confidence: number;
  summary: string;
  strengths: ReviewStrength[];
  majorIssues: ReviewIssue[];
  minorIssues: ReviewIssue[];
  questions: ReviewQuestion[];
  mainReview: string;
  optimisticView: string;
  criticalView: string;
  improvements: ImprovementItem[];
  calibration: CalibrationInfo;
}
