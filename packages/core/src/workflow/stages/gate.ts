/**
 * Gate stage: run precheck rules + LLM gate.
 * Evaluates the paper against venue-specific precheck rules to determine
 * if it should proceed to full review.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { GateResultSchema, type GateResult } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "gate-v1";

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runGate(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.gateResult) {
    return {
      stage: ReviewStage.Gate,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.gateResult,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before gate stage");
  }

  if (!context.paper) {
    throw new Error("Gate stage requires paper artifacts from intake stage");
  }

  if (!context.venue) {
    throw new Error("Gate stage requires venue context");
  }

  const rules = context.venue.precheckRules;
  const paperText = context.paper.fullText.slice(0, 20000); // Limit for context window

  const result = await provider.generateStructured<GateResult>({
    messages: [
      {
        role: "system",
        content: buildGateSystemPrompt(),
      },
      {
        role: "user",
        content: buildGateUserPrompt(paperText, rules),
      },
    ],
    schema: GateResultSchema,
    schemaName: "GateResult",
    schemaDescription: "Result of the paper gate check",
    temperature: 0,
    signal,
  });

  context.gateResult = result.data;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Gate,
    promptVersion: PROMPT_VERSION,
    model: result.model,
    result: result.data,
    evidence: result.data.findings.flatMap((f) => f.evidence),
    durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildGateSystemPrompt(): string {
  return `You are an academic paper precheck system. Your role is to evaluate papers against a set of venue-specific rules before they proceed to full review.

For each rule, determine if the paper passes or fails. Provide clear evidence (page numbers and excerpts) for each finding.

Rules with severity "reject" are hard stops - if any fails, the paper should not proceed.
Rules with severity "warn" are soft warnings - the paper can proceed but the findings should be flagged.

Be objective and thorough. If evidence is ambiguous, note it explicitly.`;
}

function buildGateUserPrompt(
  paperText: string,
  rules: Array<{ id: string; name: string; description: string; severity: "reject" | "warn"; instruction: string }>,
): string {
  const rulesText = rules
    .map(
      (r) =>
        `- Rule "${r.name}" (${r.id}) [severity: ${r.severity}]:\n  Description: ${r.description}\n  Instruction: ${r.instruction}`,
    )
    .join("\n\n");

  return `Evaluate this paper against the following precheck rules:

${rulesText}

Paper content:
---
${paperText}
---

For each rule, determine if the paper passes or fails. Provide:
1. Whether it passed
2. An explanation
3. Evidence (page numbers and relevant excerpts)

Then provide an overall summary and whether the paper passes the gate check.`;
}
