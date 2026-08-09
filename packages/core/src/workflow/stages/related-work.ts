/**
 * Related work verification stage.
 * Identifies related work, checks citation completeness,
 * and assesses how the paper positions itself relative to prior art.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { RelatedWorkResultSchema, type RelatedWorkResult } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "related-work-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runRelatedWork(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.relatedWork) {
    return {
      stage: ReviewStage.RelatedWork,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.relatedWork,
      evidence: context.relatedWork.evidence,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before related work stage");
  }

  if (!context.paper) {
    throw new Error("Related work stage requires paper artifacts");
  }

  if (!context.briefing) {
    throw new Error("Related work stage requires briefing");
  }

  const paperText = context.paper.fullText;
  const briefing = context.briefing;

  const result = await provider.generateStructured<RelatedWorkResult>({
    messages: [
      {
        role: "system",
        content: buildRelatedWorkSystemPrompt(),
      },
      {
        role: "user",
        content: buildRelatedWorkUserPrompt(paperText, briefing),
      },
    ],
    schema: RelatedWorkResultSchema,
    schemaName: "RelatedWorkResult",
    schemaDescription: "Related work analysis result",
    temperature: 0.2,
    signal,
  });

  context.relatedWork = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.RelatedWork,
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

function buildRelatedWorkSystemPrompt(): string {
  return `You are an expert in academic literature review. Your task is to:

1. Identify the most relevant related works for this paper
2. Assess whether important related works are properly cited
3. Evaluate how the paper positions itself relative to prior art
4. Judge the novelty of the contribution given the existing literature

For each related work entry, specify:
- The relationship type: extends, competes, complements, builds_on, or evaluates
- Whether it is cited in the paper
- A brief description of the relevance

Also identify any important missing citations and provide an overall assessment of the paper's positioning and novelty claims.`;
}

function buildRelatedWorkUserPrompt(
  paperText: string,
  briefing: { title: string; domain: string; subdomains: string[]; claimedNovelty: string; mainContributions: string[] },
): string {
  return `Analyze the related work landscape for this paper:

Paper Title: ${briefing.title}
Domain: ${briefing.domain}
Subdomains: ${briefing.subdomains.join(", ")}
Claimed Novelty: ${briefing.claimedNovelty}
Main Contributions:
${briefing.mainContributions.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

Full paper text:
---
${paperText}
---

Identify the key related works, assess citation completeness, and evaluate the paper's positioning and novelty relative to existing literature. Cite specific evidence from the paper.`;
}
