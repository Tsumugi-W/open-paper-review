// ─── Review Stages ───────────────────────────────────────────────────────────

export enum ReviewStage {
  Intake = "intake",
  Gate = "gate",
  Briefing = "briefing",
  RelatedWork = "related_work",
  SpecialistAudits = "specialist_audits",
  ScorePrior = "score_prior",
  ScoreCandidates = "score_candidates",
  CandidateSelection = "candidate_selection",
  Synthesis = "synthesis",
  Calibration = "calibration",
  Improvements = "improvements",
}

// ─── Job Status ──────────────────────────────────────────────────────────────

export enum ReviewJobStatus {
  Pending = "pending",
  Gate = "gate",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

// ─── Job State ───────────────────────────────────────────────────────────────

export interface ReviewJobState {
  jobId: string;
  paperId: string;
  venueId: string;
  status: ReviewJobStatus;
  currentStage: ReviewStage | null;
  completedStages: ReviewStage[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}
