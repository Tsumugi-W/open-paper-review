/**
 * Specialist audits stage.
 * Runs 5 specialist reviewers in parallel, each focusing on a different
 * dimension: methodology, novelty, experiments, writing, and ethics.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { SpecialistAuditSchema, type SpecialistAudit } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "specialists-v1";

// ─── Specialist Dimensions ──────────────────────────────────────────────────

const SPECIALIST_DIMENSIONS = [
  "methodology",
  "novelty",
  "experiments",
  "writing",
  "ethics",
] as const;

type SpecialistDimension = (typeof SPECIALIST_DIMENSIONS)[number];

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runSpecialists(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.specialistAudits && context.specialistAudits.length > 0) {
    return {
      stage: ReviewStage.SpecialistAudits,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.specialistAudits,
      evidence: context.specialistAudits.flatMap((a) =>
        a.findings.flatMap((f) => f.evidence),
      ),
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before specialist audits stage");
  }

  if (!context.paper) {
    throw new Error("Specialist audits require paper artifacts");
  }

  if (!context.briefing) {
    throw new Error("Specialist audits require briefing");
  }

  const paperText = context.paper.fullText;
  const briefing = context.briefing;

  // Run all 5 specialist audits in parallel
  const auditPromises = SPECIALIST_DIMENSIONS.map((dimension) =>
    runSingleSpecialist(dimension, paperText, briefing, provider, signal),
  );

  const audits = await Promise.all(auditPromises);

  context.specialistAudits = audits;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.SpecialistAudits,
    promptVersion: PROMPT_VERSION,
    model: "parallel",
    result: audits,
    evidence: audits.flatMap((a) => a.findings.flatMap((f) => f.evidence)),
    durationMs,
    // Token usage for parallel calls is tracked individually via the orchestrator
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
}

// ─── Single Specialist Runner ───────────────────────────────────────────────

async function runSingleSpecialist(
  dimension: SpecialistDimension,
  paperText: string,
  briefing: { title: string; domain: string; methodology: string; mainContributions: string[] },
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<SpecialistAudit> {
  const result = await provider.generateStructured<SpecialistAudit>({
    messages: [
      {
        role: "system",
        content: buildSpecialistSystemPrompt(dimension),
      },
      {
        role: "user",
        content: buildSpecialistUserPrompt(dimension, paperText, briefing),
      },
    ],
    schema: SpecialistAuditSchema,
    schemaName: "SpecialistAudit",
    schemaDescription: `Specialist audit for ${dimension}`,
    temperature: 0.2,
    signal,
  });

  return result.data;
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildSpecialistSystemPrompt(dimension: SpecialistDimension): string {
  const dimensionInstructions: Record<SpecialistDimension, string> = {
    methodology: `You are an expert in research methodology. Focus on:
- Soundness of the research design
- Appropriateness of methods for the research questions
- Statistical validity and proper use of techniques
- Potential confounds or threats to validity
- Reproducibility of the methodology`,

    novelty: `You are an expert at evaluating research novelty. Focus on:
- Originality of the core contribution
- Incremental vs. substantial advancement over prior work
- Creative application of existing techniques to new problems
- Whether the claimed novelty is supported by evidence
- Potential overlap with unpublished or concurrent work`,

    experiments: `You are an expert in experimental design and evaluation. Focus on:
- Completeness and fairness of baselines
- Appropriateness of datasets and benchmarks
- Statistical significance and error analysis
- Ablation studies and their completeness
- Reproducibility (hyperparameters, code availability)
- Potential cherry-picking or selective reporting`,

    writing: `You are an expert in academic writing and presentation. Focus on:
- Clarity and organization of the paper
- Quality of figures, tables, and visualizations
- Appropriate use of notation and terminology
- Completeness of the related work section
- Grammar, style, and readability
- Accessibility to the target audience`,

    ethics: `You are an expert in research ethics. Focus on:
- Potential societal impacts (positive and negative)
- Bias in data, methods, or evaluation
- Privacy and consent considerations
- Dual-use potential
- Proper attribution and credit
- Compliance with ethical guidelines`,
  };

  return `${dimensionInstructions[dimension]}

Provide findings as specific, actionable items with severity levels:
- critical: Fundamental flaws that undermine the contribution
- major: Significant issues that should be addressed
- minor: Small improvements or suggestions

Also identify strengths in your area. Ground every finding in specific evidence from the paper.`;
}

function buildSpecialistUserPrompt(
  dimension: SpecialistDimension,
  paperText: string,
  briefing: { title: string; domain: string; methodology: string; mainContributions: string[] },
): string {
  return `Perform a ${dimension} audit of this paper:

Title: ${briefing.title}
Domain: ${briefing.domain}
Methodology: ${briefing.methodology}
Main Contributions:
${briefing.mainContributions.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

Full paper text:
---
${paperText}
---

Provide your specialist audit focusing on ${dimension}. Include specific findings with severity levels, strengths, and an overall assessment with your confidence level.`;
}
