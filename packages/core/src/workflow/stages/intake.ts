/**
 * Intake stage: parse paper, build artifacts.
 * Extracts text, pages, chunks, and figures from the uploaded paper.
 */

import type { ReviewContext } from "../context.js";
import type { WorkflowProvider } from "../types.js";
import type { StageOutput } from "../../types/stage.js";
import { ReviewStage } from "../../types/workflow.js";
import type { PaperArtifacts, PaperPage, PaperChunk } from "../context.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_VERSION = "intake-v1";
const CHUNK_TARGET_TOKENS = 2000;

// ─── Stage Runner ───────────────────────────────────────────────────────────

export async function runIntake(
  context: ReviewContext,
  provider: WorkflowProvider,
  signal: AbortSignal,
): Promise<StageOutput> {
  // Idempotency check
  if (context.paper) {
    return {
      stage: ReviewStage.Intake,
      promptVersion: PROMPT_VERSION,
      model: "cached",
      result: context.paper,
      evidence: [],
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const startTime = Date.now();

  if (signal.aborted) {
    throw new Error("Aborted before intake stage");
  }

  // At intake time, pdfData should be pre-loaded on the context as a temporary field.
  // The orchestrator is responsible for loading the raw PDF before starting the pipeline.
  const pdfData = (context as { _rawPdfData?: string })._rawPdfData ?? "";

  // Use the provider to analyze the document and extract structured content
  const extractionResult = await provider.analyzeDocument({
    documentData: pdfData,
    documentMediaType: "application/pdf",
    prompt: buildExtractionPrompt(),
    temperature: 0,
    signal,
  });

  // Parse the extracted content into structured artifacts
  const artifacts = parseExtractionResult(extractionResult.text, context.paperId);

  // Store artifacts on context
  context.paper = artifacts;

  const durationMs = Date.now() - startTime;

  return {
    stage: ReviewStage.Intake,
    promptVersion: PROMPT_VERSION,
    model: extractionResult.model,
    result: artifacts,
    evidence: [],
    durationMs,
    inputTokens: extractionResult.usage.inputTokens,
    outputTokens: extractionResult.usage.outputTokens,
    costUsd: 0, // Computed by orchestrator from token counts
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildExtractionPrompt(): string {
  return `You are a paper extraction system. Analyze this academic paper and extract:

1. The full text content organized by page
2. Section boundaries and titles
3. Figure/table captions and their page locations
4. Any metadata (title, authors, abstract)

Output as JSON with this structure:
{
  "title": "...",
  "authors": ["..."],
  "abstract": "...",
  "pages": [{"pageNumber": 1, "text": "..."}],
  "sections": [{"title": "...", "startPage": 1, "endPage": 2, "content": "..."}],
  "figures": [{"id": "fig1", "pageNumber": 1, "caption": "..."}]
}

Be thorough and preserve all content accurately.`;
}

function parseExtractionResult(text: string, paperId: string): PaperArtifacts {
  let parsed: {
    title?: string;
    authors?: string[];
    abstract?: string;
    pages?: Array<{ pageNumber: number; text: string }>;
    sections?: Array<{
      title: string;
      startPage: number;
      endPage: number;
      content: string;
    }>;
    figures?: Array<{ id: string; pageNumber: number; caption: string }>;
  };

  try {
    // Try to extract JSON from possible markdown-wrapped response
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: treat entire response as plain text
    parsed = {
      pages: [{ pageNumber: 1, text }],
      sections: [],
      figures: [],
    };
  }

  const pages: PaperPage[] = (parsed.pages ?? []).map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
  }));

  const fullText = pages.map((p) => p.text).join("\n\n");

  // Build chunks from sections or split by size
  const chunks: PaperChunk[] = (parsed.sections ?? []).map((s, idx) => ({
    chunkIndex: idx,
    sectionTitle: s.title,
    content: s.content,
    startPage: s.startPage,
    endPage: s.endPage,
  }));

  // If no sections were parsed, create chunks by splitting text
  if (chunks.length === 0 && fullText.length > 0) {
    const chunkSize = CHUNK_TARGET_TOKENS * 4; // approximate chars per token
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push({
        chunkIndex: chunks.length,
        content: fullText.slice(i, i + chunkSize),
        startPage: 1,
        endPage: pages.length || 1,
      });
    }
  }

  const figures = (parsed.figures ?? []).map((f) => ({
    id: f.id,
    pageNumber: f.pageNumber,
    caption: f.caption,
  }));

  return {
    fullText,
    pages,
    chunks,
    figures,
    pageCount: pages.length,
    remoteArtifactIds: [],
  };
}
