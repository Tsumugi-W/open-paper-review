// ─── Score Scale ──────────────────────────────────────────────────────────────

export interface ScoreScale {
  min: number;
  max: number;
  step: number;
  /** Human-readable labels for specific score values (keyed by score value) */
  labels: Record<number, string>;
}

// ─── Review Section Definition ───────────────────────────────────────────────

export interface ReviewSectionDef {
  id: string;
  name: string;
  description: string;
  required: boolean;
  maxLength?: number;
  scoreScale?: ScoreScale;
}

// ─── Precheck Rule ───────────────────────────────────────────────────────────

export interface PrecheckRule {
  id: string;
  name: string;
  description: string;
  /** Severity: reject = hard gate, warn = flag but continue */
  severity: "reject" | "warn";
  /** Natural language instruction for the LLM evaluator */
  instruction: string;
}

// ─── Calibration Status ──────────────────────────────────────────────────────

export type CalibrationStatus = "uncalibrated" | "partial" | "calibrated";

// ─── VenueBundle Status ──────────────────────────────────────────────────────

export type VenueBundleStatus = "draft" | "active" | "archived";

// ─── Source Metadata ─────────────────────────────────────────────────────────

export interface VenueSourceMetadata {
  /** Where this bundle was sourced from (e.g. URL, manual entry) */
  origin: string;
  /** ISO date when the bundle was last fetched/updated */
  fetchedAt: string;
  /** Hash of source content for staleness detection */
  contentHash?: string;
}

// ─── VenueBundle ─────────────────────────────────────────────────────────────

export interface VenueBundle {
  id: string;
  conferenceId: string;
  track: string;
  year: number;
  version: number;
  status: VenueBundleStatus;

  scoreScale: ScoreScale;
  reviewSections: ReviewSectionDef[];
  precheckRules: PrecheckRule[];

  calibrationStatus: CalibrationStatus;
  source: VenueSourceMetadata;
}
