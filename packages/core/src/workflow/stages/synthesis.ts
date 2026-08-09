/**
 * Synthesis stage.
 * Combines all prior analyses into a coherent final review document
 * with structured sections.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { SynthesisResultSchema, type SynthesisResult } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "synthesis-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runSynthesis(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.synthesis) {
    return {
      stage: ReviewStage.Synthesis,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.synthesis,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before synthesis stage");
  }

  if (!context.candidateSelection) {
    throw new Error("Synthesis requires candidate selection");
  }

  if (!context.specialistAudits) {
    throw new Error("Synthesis requires specialist audits");
  }

  if (!context.briefing) {
    throw new Error("Synthesis requires briefing");
  }

  const result = await provider.generateStructured<SynthesisResult>({
    messages: [
      {
        role: "system",
        content: buildSynthesisSystemPrompt(),
      },
      {
        role: "user",
        content: buildSynthesisUserPrompt(context),
      },
    ],
    schema: SynthesisResultSchema,
    schemaName: "SynthesisResult",
    schemaDescription: "Synthesized review result",
    temperature: 0.2,
    maxTokens: 8000,
    signal,
  });

  context.synthesis = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Synthesis,
    promptVersion: PROMPT_VERSION,
    model: result.model,
    result: result.data,
    evidence: [
      ...result.data.strengths.flatMap((s) => s.evidence),
      ...result.data.majorIssues.flatMap((i) => i.evidence),
      ...result.data.minorIssues.flatMap((i) => i.evidence),
    ],
    durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildSynthesisSystemPrompt(): string {
  return `You are a senior meta-reviewer synthesizing a final review. Your task is to produce a comprehensive, well-structured review that:

1. Provides a clear overall score and confidence level
2. Summarizes the paper fairly in 2-3 sentences
3. Writes a detailed main review section covering key findings
4. Presents an optimistic view (best case for the paper)
5. Presents a critical view (challenges and concerns)
6. Lists concrete strengths with evidence
7. Lists major issues with evidence and suggestions
8. Lists minor issues with evidence
9. Poses questions for the authors

The review should be:
- Professional and constructive in tone
- Specific and evidence-grounded (no vague criticisms)
- Balanced between praise and critique
- Actionable (each issue should suggest how to address it)
- Consistent with the selected score`;
}

function buildSynthesisUserPrompt(context: ReviewContext): string {
  const { briefing, specialistAudits, candidateSelection, relatedWork, scoreCandidates } = context;

  const selectedCandidate = scoreCandidates?.find(
    (c) => c.id === candidateSelection?.selectedCandidateId,
  );

  const allFindings = (specialistAudits ?? []).flatMap((a) =>
    a.findings.map((f) => ({
      ...f,
      specialist: a.specialistRole,
    })),
  );

  const criticalFindings = allFindings
    .filter((f) => f.severity === "critical")
    .map((f) => `  - [${f.specialist}/${f.category}] ${f.description}`)
    .join("\n");

  const majorFindings = allFindings
    .filter((f) => f.severity === "major")
    .map((f) => `  - [${f.specialist}/${f.category}] ${f.description}`)
    .join("\n");

  const minorFindings = allFindings
    .filter((f) => f.severity === "minor")
    .map((f) => `  - [${f.specialist}/${f.category}] ${f.description}`)
    .join("\n");

  const strengths = (specialistAudits ?? [])
    .flatMap((a) => a.strengths.map((s) => ({ ...s, specialist: a.specialistRole })))
    .map((s) => `  - [${s.specialist}/${s.category}] ${s.description}`)
    .join("\n");

  return `Synthesize the final review for this paper:

Paper: ${briefing?.title ?? "Unknown"}
Final Score: ${candidateSelection?.finalScore ?? "N/A"}
Selection Rationale: ${candidateSelection?.selectionRationale ?? "N/A"}
Dissent: ${candidateSelection?.dissent ?? "None"}

Selected Candidate Perspective: ${selectedCandidate?.perspective ?? "N/A"}
Selected Candidate Justification: ${selectedCandidate?.justification ?? "N/A"}

Critical Findings:
${criticalFindings || "  None"}

Major Findings:
${majorFindings || "  None"}

Minor Findings:
${minorFindings || "  None"}

Strengths:
${strengths || "  None identified"}

Related Work Assessment:
  Novelty: ${relatedWork?.noveltyAssessment ?? "N/A"}
  Positioning: ${relatedWork?.positioningAssessment ?? "N/A"}

Produce a complete, well-structured review. Use the final score of ${candidateSelection?.finalScore ?? "N/A"} and confidence of ${candidateSelection?.confidence ?? "N/A"}.`;
}
