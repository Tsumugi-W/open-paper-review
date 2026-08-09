/**
 * Paper briefing stage.
 * Generates a structured overview of the paper including contributions,
 * methodology, domain classification, and claimed novelty.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { PaperBriefingSchema, type PaperBriefing } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "briefing-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runBriefing(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.briefing) {
    return {
      stage: ReviewStage.Briefing,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.briefing,
      evidence: context.briefing.evidence,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before briefing stage");
  }

  if (!context.paper) {
    throw new Error("Briefing stage requires paper artifacts from intake stage");
  }

  const paperText = context.paper.fullText;

  const result = await provider.generateStructured<PaperBriefing>({
    messages: [
      {
        role: "system",
        content: buildBriefingSystemPrompt(),
      },
      {
        role: "user",
        content: buildBriefingUserPrompt(paperText),
      },
    ],
    schema: PaperBriefingSchema,
    schemaName: "PaperBriefing",
    schemaDescription: "Structured briefing of the paper",
    temperature: 0.1,
    signal,
  });

  context.briefing = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Briefing,
    promptVersion: PROMPT_VERSION,
    model: result.model,
    result: result.data,
    evidence: result.data.evidence,
    durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildBriefingSystemPrompt(): string {
  return `You are an expert academic reviewer. Generate a structured briefing of a research paper that captures:

1. Title and authors
2. A concise summary of the abstract
3. Main contributions (numbered list)
4. Methodology overview
5. Research domain and subdomains
6. Key terms/keywords
7. Paper type (empirical, theoretical, systems, survey, benchmark, position, other)
8. Claimed novelty - what the authors claim is new

Ground your analysis in specific evidence from the paper. Include page numbers and excerpts.`;
}

function buildBriefingUserPrompt(paperText: string): string {
  return `Generate a structured briefing for the following paper:

---
${paperText}
---

Provide a thorough and accurate briefing. Cite specific page numbers and quote relevant excerpts as evidence for your assessments.`;
}
