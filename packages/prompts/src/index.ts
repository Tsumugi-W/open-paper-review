// ─── Registry ────────────────────────────────────────────────────────────────

export {
  registerPrompt,
  getPrompt,
  getAllPrompts,
  getPromptVersions,
  UNTRUSTED_PAPER_START,
  UNTRUSTED_PAPER_END,
  COMMON_PROHIBITED_BEHAVIORS,
  EVIDENCE_CITATION_REQUIREMENTS,
  UNCERTAINTY_HANDLING,
} from "./registry.js";

export type { PromptDefinition, PromptInputField } from "./registry.js";

// ─── Templates ───────────────────────────────────────────────────────────────

export { intakePrompt } from "./templates/intake.js";

export {
  formatCheckPrompt,
  topicCheckPrompt,
  injectionDetectionPrompt,
} from "./templates/gate.js";

export { briefingPrompt } from "./templates/briefing.js";

export { relatedWorkPrompt } from "./templates/related-work.js";

export {
  methodologyPrompt,
  noveltyPrompt,
  experimentsPrompt,
  writingPrompt,
  ethicsPrompt,
} from "./templates/specialists.js";

export {
  scorePriorPrompt,
  scoreCandidatePrompt,
  candidateSelectorPrompt,
} from "./templates/scoring.js";

export { synthesisPrompt } from "./templates/synthesis.js";

export { calibrationPrompt } from "./templates/calibration.js";

export { improvementsPrompt } from "./templates/improvements.js";
