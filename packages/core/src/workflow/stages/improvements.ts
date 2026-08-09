/**
 * Improvements stage.
 * Generates actionable improvement suggestions based on the
 * complete review analysis.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { ImprovementsResultSchema, type ImprovementsResult } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "improvements-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runImprovements(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.improvements) {
    return {
      stage: ReviewStage.Improvements,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.improvements,
      evidence: context.improvements.suggestions.flatMap((s) => s.evidence),
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before improvements stage");
  }

  if (!context.synthesis) {
    throw new Error("Improvements require synthesis result");
  }

  if (!context.calibration) {
    throw new Error("Improvements require calibration result");
  }

  if (!context.briefing) {
    throw new Error("Improvements require briefing");
  }

  const result = await provider.generateStructured<ImprovementsResult>({
    messages: [
      {
        role: "system",
        content: buildImprovementsSystemPrompt(),
      },
      {
        role: "user",
        content: buildImprovementsUserPrompt(context),
      },
    ],
    schema: ImprovementsResultSchema,
    schemaName: "ImprovementsResult",
    schemaDescription: "Improvement suggestions",
    temperature: 0.3,
    signal,
  });

  context.improvements = result.data;

  // Assemble the final result
  context.finalResult = {
    ...context.synthesis,
    calibration: context.calibration,
    improvements: context.improvements,
  };

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Improvements,
    promptVersion: PROMPT_VERSION,
    model: result.model,
    result: result.data,
    evidence: result.data.suggestions.flatMap((s) => s.evidence),
    durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildImprovementsSystemPrompt(): string {
  return `You are an expert research advisor generating actionable improvement suggestions for a paper. Your suggestions should:

1. Be specific and actionable (not vague advice)
2. Be prioritized by impact and feasibility
3. Estimate the effort required (low/medium/high)
4. Explain the expected impact of each improvement
5. Reference specific evidence from the paper
6. Cover different aspects: methodology, experiments, writing, framing

Focus on improvements that would meaningfully increase the paper's chances of acceptance at the target venue. Distinguish between:
- High priority: Must-fix issues that significantly impact the score
- Medium priority: Would noticeably improve the paper
- Low priority: Nice-to-have polish items

Provide 5-10 concrete suggestions.`;
}

function buildImprovementsUserPrompt(context: ReviewContext): string {
  const { synthesis, calibration, briefing, specialistAudits } = context;

  const majorIssues = (synthesis?.majorIssues ?? [])
    .map((i) => `  - [${i.category}] ${i.description}${i.suggestion ? ` (suggestion: ${i.suggestion})` : ""}`)
    .join("\n");

  const minorIssues = (synthesis?.minorIssues ?? [])
    .map((i) => `  - [${i.category}] ${i.description}`)
    .join("\n");

  const specialistSuggestions = (specialistAudits ?? [])
    .flatMap((a) =>
      a.findings
        .filter((f) => f.suggestion)
        .map((f) => `  - [${a.specialistRole}] ${f.suggestion}`),
    )
    .join("\n");

  return `Generate improvement suggestions for this paper:

Title: ${briefing?.title ?? "Unknown"}
Current Score: ${calibration?.calibratedScore ?? synthesis?.overallScore ?? "N/A"}
Score Percentile: ${calibration?.percentile ?? "N/A"}%

Main Review Summary: ${synthesis?.summary ?? "N/A"}

Major Issues:
${majorIssues || "  None"}

Minor Issues:
${minorIssues || "  None"}

Specialist Suggestions:
${specialistSuggestions || "  None"}

Critical View: ${synthesis?.criticalView ?? "N/A"}

Generate prioritized, actionable improvement suggestions that would help the authors strengthen their paper. For each suggestion, provide evidence references and effort/impact estimates.`;
}
