// Types
export type {
  MessageRole,
  TextContent,
  ImageContent,
  MessageContent,
  Message,
  DocumentInputType,
  DocumentInput,
  TokenUsage,
  GenerateTextResult,
  GenerateStructuredResult,
  ProviderCapabilities,
  GenerateTextOptions,
  GenerateStructuredOptions,
  AnalyzeDocumentOptions,
  ProviderAdapter,
} from "./types/provider.js";

export type {
  ScoreScale,
  ReviewSectionDef,
  PrecheckRule,
  CalibrationStatus,
  VenueBundleStatus,
  VenueSourceMetadata,
  VenueBundle,
} from "./types/venue.js";

export type { BoundingBox, EvidenceRef } from "./types/evidence.js";

export type { StageOutput } from "./types/stage.js";

export type {
  ReviewIssue,
  ReviewStrength,
  ReviewQuestion,
  ImprovementItem,
  CalibrationInfo,
  ReviewResult,
} from "./types/review.js";

export { ReviewStage, ReviewJobStatus } from "./types/workflow.js";
export type { ReviewJobState } from "./types/workflow.js";

// Schemas
export {
  EvidenceRefSchema,
  GateFindingSchema,
  GateResultSchema,
  PaperBriefingSchema,
  RelatedWorkEntrySchema,
  RelatedWorkResultSchema,
  AuditFindingSchema,
  SpecialistAuditSchema,
  ScorePriorSchema,
  ScoreCandidateSchema,
  CandidateSelectionSchema,
  SynthesisResultSchema,
  CalibrationResultSchema,
  ImprovementSuggestionSchema,
  ImprovementsResultSchema,
} from "./schemas/index.js";

export type {
  GateFinding,
  GateResult,
  PaperBriefing,
  RelatedWorkEntry,
  RelatedWorkResult,
  AuditFinding,
  SpecialistAudit,
  ScorePrior,
  ScoreCandidate,
  CandidateSelection,
  SynthesisResult,
  CalibrationResult,
  ImprovementSuggestion,
  ImprovementsResult,
} from "./schemas/index.js";

// PDF Processing
export { PdfProcessor, PdfProcessingError } from "./pdf/processor.js";
export { ArtifactBuilder } from "./pdf/artifacts.js";
export type { PaperArtifact, PageArtifact, ChunkArtifact, FigureRef } from "./pdf/types.js";

// Security
export { InjectionDetector } from "./security/injection.js";
export { SsrfGuard, SsrfError } from "./security/ssrf.js";
export type { InjectionFinding, SecurityScanResult } from "./security/types.js";

// Retrieval
export { OpenAlexClient } from "./retrieval/openalex.js";
export { SemanticScholarClient } from "./retrieval/semantic-scholar.js";
export { RetrievalService } from "./retrieval/service.js";
export type { RetrievedWork, RetrievalSource, RetrievalConfig } from "./retrieval/types.js";

// Calibration
export { IsotonicCalibrator } from "./calibration/isotonic.js";
export type { CalibrationData, CalibrationMetrics, BenchmarkCard } from "./calibration/types.js";

// Cost Estimation
export { CostEstimator } from "./cost/estimator.js";
export { PRICING_TABLE, getPricing } from "./cost/pricing.js";
export type { CostEstimate, PricingEntry } from "./cost/types.js";
