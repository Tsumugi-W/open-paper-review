/**
 * Candidate selection stage.
 * Evaluates all score candidates and selects the best one
 * as the basis for the final review.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { CandidateSelectionSchema, type CandidateSelection } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "candidate-selection-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runCandidateSelection(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.candidateSelection) {
    return {
      stage: ReviewStage.CandidateSelection,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.candidateSelection,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before candidate selection stage");
  }

  if (!context.scoreCandidates || context.scoreCandidates.length === 0) {
    throw new Error("Candidate selection requires score candidates");
  }

  if (!context.specialistAudits) {
    throw new Error("Candidate selection requires specialist audits");
  }

  const result = await provider.generateStructured<CandidateSelection>({
    messages: [
      {
        role: "system",
        content: buildSelectionSystemPrompt(),
      },
      {
        role: "user",
        content: buildSelectionUserPrompt(context),
      },
    ],
    schema: CandidateSelectionSchema,
    schemaName: "CandidateSelection",
    schemaDescription: "Selected candidate and final score",
    temperature: 0.1,
    signal,
  });

  context.candidateSelection = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.CandidateSelection,
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

function buildSelectionSystemPrompt(): string {
  return `You are a meta-reviewer responsible for selecting the most appropriate review candidate. Your role is to:

1. Evaluate each candidate's justification for internal consistency
2. Check that each candidate's arguments are well-supported by evidence
3. Identify which candidate best reflects the overall evidence
4. Consider whether any candidate perspective is more appropriate for this paper
5. Select the final score (may be the same as a candidate or a synthesis)

Be fair, calibrated, and justify your selection clearly. If there is meaningful dissent between candidates, note it.`;
}

function buildSelectionUserPrompt(context: ReviewContext): string {
  const { scoreCandidates, specialistAudits, scorePrior } = context;

  const candidateSummaries = (scoreCandidates ?? [])
    .map(
      (c) =>
        `  Candidate ${c.id} (score: ${c.score}, perspective: ${c.perspective}, confidence: ${c.confidence}):\n    Justification: ${c.justification}\n    Strengths: ${c.strengths.join("; ")}\n    Weaknesses: ${c.weaknesses.join("; ")}`,
    )
    .join("\n\n");

  const criticalIssues = (specialistAudits ?? [])
    .flatMap((a) => a.findings.filter((f) => f.severity === "critical"))
    .map((f) => `  - [${f.category}] ${f.description}`)
    .join("\n");

  return `Select the best candidate from the following review candidates:

${candidateSummaries}

Critical Issues Identified:
${criticalIssues || "  None"}

Score Prior: ${scorePrior?.expectedRange.low}-${scorePrior?.expectedRange.high}
Prior Rationale: ${scorePrior?.rationale ?? "Not available"}

Select the best candidate, provide a final score, and explain your selection rationale. Note any dissent if candidates disagree significantly.`;
}
