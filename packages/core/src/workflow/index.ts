/**
 * Workflow module barrel exports.
 * Provides the state machine, orchestrator, context, and stage runners.
 */

// ─── Workflow Types ─────────────────────────────────────────────────────────

export type {
  WorkflowProvider,
  WorkflowTokenUsage,
  WorkflowMessage,
  WorkflowGenerateTextResult,
  WorkflowGenerateStructuredOptions,
  WorkflowGenerateStructuredResult,
  WorkflowAnalyzeDocumentOptions,
} from "./types.js";

// ─── State Machine ──────────────────────────────────────────────────────────

export {
  MachineState,
  ReviewStateMachine,
  PIPELINE_ORDER,
} from "./machine.js";
export type { StateEntry, MachineSnapshot } from "./machine.js";

// ─── Context ────────────────────────────────────────────────────────────────

export {
  createReviewContext,
  recordUsage,
  tokenUsageToRecord,
} from "./context.js";
export type {
  ReviewContext,
  PaperArtifacts,
  PaperPage,
  PaperChunk,
  PaperFigure,
  VenueContext,
  UsageRecord,
  GateConfirmation,
} from "./context.js";

// ─── Orchestrator ───────────────────────────────────────────────────────────

export { ReviewOrchestrator } from "./orchestrator.js";
export type {
  OrchestratorEvents,
  OrchestratorConfig,
  JobPersistence,
} from "./orchestrator.js";

// ─── Stage Runners ──────────────────────────────────────────────────────────

export { runIntake } from "./stages/intake.js";
export { runGate } from "./stages/gate.js";
export { runBriefing } from "./stages/briefing.js";
export { runRelatedWork } from "./stages/related-work.js";
export { runSpecialists } from "./stages/specialists.js";
export { runScorePrior } from "./stages/score-prior.js";
export { runScoreCandidates } from "./stages/score-candidates.js";
export { runCandidateSelection } from "./stages/candidate-selection.js";
export { runSynthesis } from "./stages/synthesis.js";
export { runCalibration } from "./stages/calibration.js";
export { runImprovements } from "./stages/improvements.js";
