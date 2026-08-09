/**
 * Score candidates stage.
 * Generates one candidate review per score point in the expected range,
 * each with a different perspective. Runs in parallel.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import { ScoreCandidateSchema, type ScoreCandidate } from "../../schemas/index.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "score-candidates-v1";

// ─── Perspective Rotation ───────────────────────────────────────────────────

const PERSPECTIVES: Array<"optimistic" | "balanced" | "critical"> = [
  "optimistic",
  "balanced",
  "critical",
];

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runScoreCandidates(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.scoreCandidates && context.scoreCandidates.length > 0) {
    return {
      stage: ReviewStage.ScoreCandidates,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.scoreCandidates,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before score candidates stage");
  }

  if (!context.scorePrior) {
    throw new Error("Score candidates require score prior");
  }

  if (!context.venue) {
    throw new Error("Score candidates require venue context");
  }

  if (!context.briefing) {
    throw new Error("Score candidates require briefing");
  }

  if (!context.specialistAudits) {
    throw new Error("Score candidates require specialist audits");
  }

  // Determine score points to generate candidates for
  const { low, high } = context.scorePrior.expectedRange;
  const { step, min, max } = context.venue.scoreScale;

  // Generate candidates for each score point in the range (clamped to scale)
  const scoreLow = Math.max(min, Math.floor(low));
  const scoreHigh = Math.min(max, Math.ceil(high));
  const scorePoints: number[] = [];
  for (let s = scoreLow; s <= scoreHigh; s += step) {
    scorePoints.push(s);
  }

  // Ensure at least 3 candidates if range is too narrow
  if (scorePoints.length < 3) {
    const mid = Math.round((low + high) / 2);
    scorePoints.length = 0;
    scorePoints.push(
      Math.max(min, mid - step),
      mid,
      Math.min(max, mid + step),
    );
  }

  // Run all candidate generations in parallel
  const candidatePromises = scorePoints.map((score, idx) => {
    const perspective = PERSPECTIVES[idx % PERSPECTIVES.length];
    return generateCandidate(
      score,
      perspective,
      context,
      provider,
      signal,
    );
  });

  const candidates = await Promise.all(candidatePromises);

  context.scoreCandidates = candidates;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.ScoreCandidates,
    promptVersion: PROMPT_VERSION,
    model: "parallel",
    result: candidates,
    evidence: [],
    durationMs,
    inputTokens: 0, // Aggregated at orchestrator level via usage records
    outputTokens: 0,
    costUsd: 0,
  };
}

// ─── Single Candidate Generator ─────────────────────────────────────────────

async function generateCandidate(
  targetScore: number,
  perspective: "optimistic" | "balanced" | "critical",
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<ScoreCandidate> {
  const result = await provider.generateStructured<ScoreCandidate>({
    messages: [
      {
        role: "system",
        content: buildCandidateSystemPrompt(perspective),
      },
      {
        role: "user",
        content: buildCandidateUserPrompt(targetScore, perspective, context),
      },
    ],
    schema: ScoreCandidateSchema,
    schemaName: "ScoreCandidate",
    schemaDescription: `Score candidate for score ${targetScore} (${perspective})`,
    temperature: 0.4,
    signal,
  });

  return result.data;
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildCandidateSystemPrompt(perspective: "optimistic" | "balanced" | "critical"): string {
  const perspectiveInstructions: Record<string, string> = {
    optimistic: "You take an optimistic view, giving weight to the paper's strengths and potential impact. You acknowledge weaknesses but focus on how they might be addressed.",
    balanced: "You take a balanced view, weighing strengths and weaknesses fairly without bias toward either direction.",
    critical: "You take a critical view, focusing on weaknesses, potential flaws, and what would need to be improved. You acknowledge strengths but prioritize issues.",
  };

  return `You are a calibrated academic reviewer with a ${perspective} perspective. ${perspectiveInstructions[perspective]}

Generate a review candidate that argues for a specific score. Your justification must be:
1. Well-supported by the evidence from specialist audits
2. Consistent with the perspective you're adopting
3. Fair and intellectually honest
4. Grounded in the venue's standards`;
}

function buildCandidateUserPrompt(
  targetScore: number,
  perspective: "optimistic" | "balanced" | "critical",
  context: ReviewContext,
): string {
  const { briefing, specialistAudits, scorePrior, venue, relatedWork } = context;

  const auditFindings = (specialistAudits ?? [])
    .map((a) => {
      const findings = a.findings
        .map((f) => `    [${f.severity}] ${f.description}`)
        .join("\n");
      const strengths = a.strengths
        .map((s) => `    [+] ${s.description}`)
        .join("\n");
      return `  ${a.specialistRole}:\n    Assessment: ${a.overallAssessment}\n${findings}\n${strengths}`;
    })
    .join("\n\n");

  return `Generate a review candidate arguing for score ${targetScore} from a ${perspective} perspective.

Paper: ${briefing?.title ?? "Unknown"}
Domain: ${briefing?.domain ?? "Unknown"}
Score Scale: ${venue?.scoreScale.min}-${venue?.scoreScale.max}
Score Prior Range: ${scorePrior?.expectedRange.low}-${scorePrior?.expectedRange.high}

Specialist Audit Findings:
${auditFindings}

Related Work:
  Novelty: ${relatedWork?.noveltyAssessment ?? "Not assessed"}

Provide your unique ID, the target score, your justification, key strengths and weaknesses from your perspective, and your confidence in this score being correct.`;
}
