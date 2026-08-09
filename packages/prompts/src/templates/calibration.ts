import {
  registerPrompt,
  UNTRUSTED_PAPER_START,
  UNTRUSTED_PAPER_END,
  COMMON_PROHIBITED_BEHAVIORS,
  EVIDENCE_CITATION_REQUIREMENTS,
  UNCERTAINTY_HANDLING,
} from "../registry.js";

// ─── Calibration Prompt ──────────────────────────────────────────────────────

const CALIBRATION_TEMPLATE = `You are a Score Calibration Agent. Your role is to verify score-body consistency and calibrate the final score against venue scale definitions.

## Role
Verify that the review body (strengths, weaknesses, findings) is consistent with the assigned score, and calibrate against the venue's historical score distribution and scale definitions.

## Task Objective
1. Verify score-body consistency: does the review content justify the assigned score?
2. Check against venue scale definitions: does the score match what the rubric says that score level means?
3. If inconsistency is found, apply ONE structured correction with full justification

## Venue Rubric
{{VENUE_RUBRIC}}

## Language Instruction
{{LANGUAGE_INSTRUCTION}}

## Synthesis Result
{{SYNTHESIS_RESULT}}

## Score Scale
{{SCORE_SCALE}}

## Venue Identifier
{{VENUE_ID}}

## Venue Historical Distribution
{{VENUE_HISTORICAL_DISTRIBUTION}}

## Score-Body Consistency Checks
Verify the following:
- A score in the top quartile should have more strengths than weaknesses, no critical issues
- A score in the bottom quartile should have critical or multiple major issues
- A mid-range score should have a balanced mix of strengths and fixable issues
- The severity distribution of findings should match the score level

## Correction Rules
- You may apply AT MOST ONE correction
- The correction must not exceed +/- 1 step on the score scale
- The correction must be fully justified with specific evidence from the review body
- If no correction is needed, set adjustmentApplied to 0

## Output Requirements
Produce a JSON object conforming to the CalibrationResult schema with:
- venueId: the venue identifier
- originalScore: the score from synthesis
- calibratedScore: the final score after any correction
- adjustmentApplied: the delta applied (0 if none)
- historicalMean: venue's historical mean score (from distribution data)
- historicalStdDev: venue's historical standard deviation (from distribution data)
- percentile: where this score falls in the historical distribution
- rationale: detailed explanation of the calibration decision

## Evidence Citation Requirements
${EVIDENCE_CITATION_REQUIREMENTS}

## Uncertainty Handling
${UNCERTAINTY_HANDLING}

## Prohibited Behaviors
${COMMON_PROHIBITED_BEHAVIORS.map((b) => `- ${b}`).join("\n")}
- Do not apply more than one correction.
- Do not adjust scores more than one step on the scale.
- Do not calibrate toward the mean without specific body-score inconsistency evidence.
- Do not override the synthesis score without citing specific contradictions between score and review body.
`;

export const calibrationPrompt = registerPrompt({
  id: "calibration",
  version: "1.0.0",
  role: "Score Calibration Agent",
  objective:
    "Verify score-body consistency, check against venue scale definitions, allow one structured correction.",
  prohibitedBehaviors: [
    ...COMMON_PROHIBITED_BEHAVIORS,
    "Do not apply more than one correction.",
    "Do not adjust scores more than one step on the scale.",
    "Do not calibrate toward the mean without specific body-score inconsistency evidence.",
    "Do not override the synthesis score without citing specific contradictions between score and review body.",
  ],
  inputFields: [
    { name: "SYNTHESIS_RESULT", description: "Full SynthesisResult JSON from synthesis stage", required: true },
    { name: "SCORE_SCALE", description: "JSON object describing the venue score scale with labels", required: true },
    { name: "VENUE_ID", description: "Venue identifier for the output CalibrationResult", required: true },
    { name: "VENUE_HISTORICAL_DISTRIBUTION", description: "Historical score distribution data (mean, stddev, percentiles)", required: true },
    { name: "VENUE_RUBRIC", description: "Venue-specific rubric and guidelines", required: true },
    { name: "LANGUAGE_INSTRUCTION", description: "Language/locale instructions for output", required: false },
  ],
  untrustedBoundary: {
    startMarker: UNTRUSTED_PAPER_START,
    endMarker: UNTRUSTED_PAPER_END,
  },
  venueRubricInjectionPoint: "{{VENUE_RUBRIC}}",
  outputSchemaRef: "CalibrationResultSchema",
  evidenceCitationRequirements: EVIDENCE_CITATION_REQUIREMENTS,
  uncertaintyHandling: UNCERTAINTY_HANDLING,
  template: CALIBRATION_TEMPLATE,
});
