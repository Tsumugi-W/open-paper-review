/**
 * Calibration stage.
 * Calibrates the review score against venue historical data
 * and verifies consistency of the overall assessment.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { CalibrationResultSchema, type CalibrationResult } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "calibration-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runCalibration(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.calibration) {
    return {
      stage: ReviewStage.Calibration,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.calibration,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before calibration stage");
  }

  if (!context.synthesis) {
    throw new Error("Calibration requires synthesis result");
  }

  if (!context.venue) {
    throw new Error("Calibration requires venue context");
  }

  const result = await provider.generateStructured<CalibrationResult>({
    messages: [
      {
        role: "system",
        content: buildCalibrationSystemPrompt(),
      },
      {
        role: "user",
        content: buildCalibrationUserPrompt(context),
      },
    ],
    schema: CalibrationResultSchema,
    schemaName: "CalibrationResult",
    schemaDescription: "Calibrated score result",
    temperature: 0.1,
    signal,
  });

  context.calibration = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Calibration,
    promptVersion: PROMPT_VERSION,
    model: result.model,
    result: result.data,
    evidence: [],
    durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildCalibrationSystemPrompt(): string {
  return `You are a review calibration system. Your role is to:

1. Compare the proposed score against historical review distributions for this venue
2. Check for systematic biases (too harsh/lenient)
3. Verify the score is consistent with the identified strengths and weaknesses
4. Apply any necessary calibration adjustment
5. Determine the percentile of this paper relative to historical submissions

Calibration should:
- Use venue historical data (mean, std dev) if available
- Never change the score by more than 1 point unless there's clear justification
- Explain any adjustment made
- Report the final calibrated score and percentile

If no historical data is available, validate internal consistency without adjusting.`;
}

function buildCalibrationUserPrompt(context: ReviewContext): string {
  const { synthesis, venue, candidateSelection } = context;

  const scoreScale = venue?.scoreScale;
  const originalScore = synthesis?.overallScore ?? candidateSelection?.finalScore ?? 0;

  return `Calibrate the following review score:

Venue: ${venue?.conferenceId ?? "Unknown"} / ${venue?.track ?? "Unknown"} (${venue?.year ?? "Unknown"})
Score Scale: ${scoreScale?.min ?? 1}-${scoreScale?.max ?? 10} (step: ${scoreScale?.step ?? 1})
Score Labels: ${scoreScale ? Object.entries(scoreScale.labels).map(([k, v]) => `${k}=${v}`).join(", ") : "N/A"}

Original Score: ${originalScore}
Confidence: ${synthesis?.confidence ?? candidateSelection?.confidence ?? 0}

Review Summary: ${synthesis?.summary ?? "N/A"}

Major Issues Count: ${synthesis?.majorIssues.length ?? 0}
Minor Issues Count: ${synthesis?.minorIssues.length ?? 0}
Strengths Count: ${synthesis?.strengths.length ?? 0}

Selection Dissent: ${candidateSelection?.dissent ?? "None"}

Note: For historical calibration, assume a mean of ${Math.round(((scoreScale?.min ?? 1) + (scoreScale?.max ?? 10)) / 2 * 10) / 10} and std dev of ${Math.round(((scoreScale?.max ?? 10) - (scoreScale?.min ?? 1)) / 4 * 10) / 10} if no venue-specific data is available.

Provide the calibrated score, any adjustment made, the percentile, and your rationale.`;
}
