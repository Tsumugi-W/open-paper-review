/**
 * Score prior stage.
 * Generates a prior distribution over expected scores based on
 * the briefing, specialist findings, and venue calibration data.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { ScorePriorSchema, type ScorePrior } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "score-prior-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runScorePrior(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.scorePrior) {
    return {
      stage: ReviewStage.ScorePrior,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.scorePrior,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before score prior stage");
  }

  if (!context.briefing) {
    throw new Error("Score prior requires briefing");
  }

  if (!context.specialistAudits) {
    throw new Error("Score prior requires specialist audits");
  }

  if (!context.venue) {
    throw new Error("Score prior requires venue context");
  }

  const result = await provider.generateStructured<ScorePrior>({
    messages: [
      {
        role: "system",
        content: buildScorePriorSystemPrompt(),
      },
      {
        role: "user",
        content: buildScorePriorUserPrompt(context),
      },
    ],
    schema: ScorePriorSchema,
    schemaName: "ScorePrior",
    schemaDescription: "Score prior distribution",
    temperature: 0.3,
    signal,
  });

  context.scorePrior = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.ScorePrior,
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

function buildScorePriorSystemPrompt(): string {
  return `You are a calibrated academic reviewer. Based on the paper briefing and specialist audit findings, estimate a prior distribution over expected review scores.

Consider:
1. The severity and count of issues found by specialists
2. The strengths identified
3. The novelty assessment
4. The quality of methodology and experiments
5. The venue's standards and score scale

Provide:
- An expected score range (low to high)
- Key factors influencing the score (with direction and weight)
- Comparable papers and their scores (if possible)
- A rationale for your estimate

Be calibrated - do not systematically over- or under-estimate scores.`;
}

function buildScorePriorUserPrompt(context: ReviewContext): string {
  const { briefing, specialistAudits, venue, relatedWork } = context;

  const auditSummary = (specialistAudits ?? [])
    .map((a) => {
      const criticalCount = a.findings.filter((f) => f.severity === "critical").length;
      const majorCount = a.findings.filter((f) => f.severity === "major").length;
      const minorCount = a.findings.filter((f) => f.severity === "minor").length;
      return `  ${a.specialistRole} (${a.domain}): ${criticalCount} critical, ${majorCount} major, ${minorCount} minor issues; confidence: ${a.confidenceInAssessment}`;
    })
    .join("\n");

  const scoreScaleDesc = venue
    ? `Score scale: ${venue.scoreScale.min}-${venue.scoreScale.max} (step: ${venue.scoreScale.step})\nLabels: ${Object.entries(venue.scoreScale.labels).map(([k, v]) => `${k}=${v}`).join(", ")}`
    : "No score scale available";

  return `Generate a score prior for this paper:

Title: ${briefing?.title ?? "Unknown"}
Domain: ${briefing?.domain ?? "Unknown"}
Paper Type: ${briefing?.paperType ?? "Unknown"}
Claimed Novelty: ${briefing?.claimedNovelty ?? "Unknown"}

Specialist Audit Summary:
${auditSummary}

Related Work Assessment:
  Novelty: ${relatedWork?.noveltyAssessment ?? "Not assessed"}
  Positioning: ${relatedWork?.positioningAssessment ?? "Not assessed"}
  Missing Citations: ${relatedWork?.missingCitations?.length ?? 0}

Venue: ${venue?.conferenceId ?? "Unknown"} / ${venue?.track ?? "Unknown"} (${venue?.year ?? "Unknown"})
${scoreScaleDesc}

Based on all available evidence, estimate the expected score range and key factors.`;
}
