import { z } from "zod";

// ─── Shared Schemas ──────────────────────────────────────────────────────────

export const EvidenceRefSchema = z.object({
  paperId: z.string(),
  pageNumber: z.number().int().nonnegative(),
  chunkId: z.string().optional(),
  excerpt: z.string(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
});

// ─── Gate Finding ────────────────────────────────────────────────────────────

export const GateFindingSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  passed: z.boolean(),
  severity: z.enum(["reject", "warn"]),
  explanation: z.string(),
  evidence: z.array(EvidenceRefSchema),
});

export type GateFinding = z.infer<typeof GateFindingSchema>;

export const GateResultSchema = z.object({
  passed: z.boolean(),
  findings: z.array(GateFindingSchema),
  summary: z.string(),
});

export type GateResult = z.infer<typeof GateResultSchema>;

// ─── Paper Briefing ──────────────────────────────────────────────────────────

export const PaperBriefingSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstractSummary: z.string(),
  mainContributions: z.array(z.string()),
  methodology: z.string(),
  domain: z.string(),
  subdomains: z.array(z.string()),
  keywords: z.array(z.string()),
  paperType: z.enum([
    "empirical",
    "theoretical",
    "systems",
    "survey",
    "benchmark",
    "position",
    "other",
  ]),
  claimedNovelty: z.string(),
  evidence: z.array(EvidenceRefSchema),
});

export type PaperBriefing = z.infer<typeof PaperBriefingSchema>;

// ─── Related Work Result ─────────────────────────────────────────────────────

export const RelatedWorkEntrySchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int(),
  venue: z.string().optional(),
  relevance: z.string(),
  relationship: z.enum(["extends", "competes", "complements", "builds_on", "evaluates"]),
  citedInPaper: z.boolean(),
});

export type RelatedWorkEntry = z.infer<typeof RelatedWorkEntrySchema>;

export const RelatedWorkResultSchema = z.object({
  entries: z.array(RelatedWorkEntrySchema),
  missingCitations: z.array(z.string()),
  positioningAssessment: z.string(),
  noveltyAssessment: z.string(),
  evidence: z.array(EvidenceRefSchema),
});

export type RelatedWorkResult = z.infer<typeof RelatedWorkResultSchema>;

// ─── Specialist Audit ────────────────────────────────────────────────────────

export const AuditFindingSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  evidence: z.array(EvidenceRefSchema),
  suggestion: z.string().optional(),
});

export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const SpecialistAuditSchema = z.object({
  specialistRole: z.string(),
  domain: z.string(),
  findings: z.array(AuditFindingSchema),
  strengths: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      description: z.string(),
      evidence: z.array(EvidenceRefSchema),
    })
  ),
  overallAssessment: z.string(),
  confidenceInAssessment: z.number().min(0).max(1),
});

export type SpecialistAudit = z.infer<typeof SpecialistAuditSchema>;

// ─── Score Prior ─────────────────────────────────────────────────────────────

export const ScorePriorSchema = z.object({
  expectedRange: z.object({
    low: z.number(),
    high: z.number(),
  }),
  rationale: z.string(),
  keyFactors: z.array(
    z.object({
      factor: z.string(),
      direction: z.enum(["positive", "negative", "neutral"]),
      weight: z.number().min(0).max(1),
    })
  ),
  comparablePapers: z.array(
    z.object({
      description: z.string(),
      score: z.number(),
      similarity: z.string(),
    })
  ),
});

export type ScorePrior = z.infer<typeof ScorePriorSchema>;

// ─── Score Candidate ─────────────────────────────────────────────────────────

export const ScoreCandidateSchema = z.object({
  id: z.string(),
  score: z.number(),
  perspective: z.enum(["optimistic", "balanced", "critical"]),
  justification: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ScoreCandidate = z.infer<typeof ScoreCandidateSchema>;

// ─── Candidate Selection ─────────────────────────────────────────────────────

export const CandidateSelectionSchema = z.object({
  selectedCandidateId: z.string(),
  finalScore: z.number(),
  selectionRationale: z.string(),
  dissent: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type CandidateSelection = z.infer<typeof CandidateSelectionSchema>;

// ─── Synthesis Result ────────────────────────────────────────────────────────

export const SynthesisResultSchema = z.object({
  overallScore: z.number(),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  mainReview: z.string(),
  optimisticView: z.string(),
  criticalView: z.string(),
  strengths: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      description: z.string(),
      evidence: z.array(EvidenceRefSchema),
    })
  ),
  majorIssues: z.array(AuditFindingSchema),
  minorIssues: z.array(AuditFindingSchema),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      context: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    })
  ),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// ─── Calibration Result ──────────────────────────────────────────────────────

export const CalibrationResultSchema = z.object({
  venueId: z.string(),
  originalScore: z.number(),
  calibratedScore: z.number(),
  adjustmentApplied: z.number(),
  historicalMean: z.number(),
  historicalStdDev: z.number(),
  percentile: z.number().min(0).max(100),
  rationale: z.string(),
});

export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;

// ─── Improvement Suggestion ──────────────────────────────────────────────────

export const ImprovementSuggestionSchema = z.object({
  id: z.string(),
  area: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  effort: z.enum(["low", "medium", "high"]),
  expectedImpact: z.string(),
  evidence: z.array(EvidenceRefSchema),
});

export type ImprovementSuggestion = z.infer<typeof ImprovementSuggestionSchema>;

export const ImprovementsResultSchema = z.object({
  suggestions: z.array(ImprovementSuggestionSchema),
  summary: z.string(),
});

export type ImprovementsResult = z.infer<typeof ImprovementsResultSchema>;
