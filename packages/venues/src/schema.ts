import { z } from "zod";

// ─── Score Scale ──────────────────────────────────────────────────────────────

export const ScoreScaleSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number(),
  labels: z.record(z.coerce.number(), z.string()),
});

export type ScoreScale = z.infer<typeof ScoreScaleSchema>;

// ─── Review Section ─────────────────────────────────────────────────────────

export const ReviewSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  required: z.boolean(),
  description: z.string(),
  maxLength: z.number().int().positive().optional(),
});

export type ReviewSection = z.infer<typeof ReviewSectionSchema>;

// ─── Precheck Rule ──────────────────────────────────────────────────────────

export const PrecheckRuleSchema = z.object({
  id: z.string(),
  type: z.enum(["hard_stop", "needs_confirmation"]),
  condition: z.string(),
  message: z.string(),
});

export type PrecheckRule = z.infer<typeof PrecheckRuleSchema>;

// ─── Calibration ────────────────────────────────────────────────────────────

export const CalibrationSchema = z.object({
  status: z.enum(["rubric_only", "partial", "calibrated"]),
  dataSize: z.number().int().nonnegative().optional(),
  mae: z.number().nonnegative().optional(),
  spearman: z.number().min(-1).max(1).optional(),
  kappa: z.number().min(-1).max(1).optional(),
  lastUpdated: z.string().optional(),
});

export type Calibration = z.infer<typeof CalibrationSchema>;

// ─── Source Metadata ────────────────────────────────────────────────────────

export const SourceSchema = z.object({
  url: z.string().url(),
  accessDate: z.string(),
  maintainerNote: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

// ─── Venue Bundle Status ────────────────────────────────────────────────────

export const VenueBundleStatusSchema = z.enum([
  "rubric_only",
  "calibrated",
  "deprecated",
]);

export type VenueBundleStatus = z.infer<typeof VenueBundleStatusSchema>;

// ─── Venue Bundle ───────────────────────────────────────────────────────────

export const VenueBundleSchema = z.object({
  id: z.string(),
  conferenceId: z.string(),
  track: z.string(),
  year: z.number().int(),
  version: z.number().int().positive(),
  status: VenueBundleStatusSchema,
  scoreScale: ScoreScaleSchema,
  reviewSections: z.array(ReviewSectionSchema),
  precheckRules: z.array(PrecheckRuleSchema),
  calibration: CalibrationSchema,
  source: SourceSchema,
});

export type VenueBundle = z.infer<typeof VenueBundleSchema>;
