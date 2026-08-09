/**
 * Workflow-local type definitions.
 * Defines the provider interface that the workflow expects.
 * This avoids circular dependencies between @opr/core and @opr/providers.
 * The actual provider adapters from @opr/providers satisfy this interface structurally.
 */

import type { z } from "zod";

// ─── Token Usage ────────────────────────────────────────────────────────────

export interface WorkflowTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// ─── Messages ───────────────────────────────────────────────────────────────

export interface WorkflowMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

// ─── Generate Text Options/Result ───────────────────────────────────────────

export interface WorkflowGenerateTextResult {
  text: string;
  usage: WorkflowTokenUsage;
  model: string;
  finishReason: string;
}

// ─── Generate Structured Options/Result ─────────────────────────────────────

export interface WorkflowGenerateStructuredOptions<T = unknown> {
  messages: WorkflowMessage[];
  schema: z.ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface WorkflowGenerateStructuredResult<T = unknown> {
  data: T;
  usage: WorkflowTokenUsage;
  model: string;
  finishReason: string;
}

// ─── Analyze Document Options ───────────────────────────────────────────────

export interface WorkflowAnalyzeDocumentOptions {
  documentData: string;
  documentMediaType: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  remoteFileId?: string;
}

// ─── Workflow Provider Adapter ──────────────────────────────────────────────

/**
 * The provider interface expected by the workflow engine.
 * Structurally compatible with @opr/providers ProviderAdapter.
 */
export interface WorkflowProvider {
  readonly name: string;

  generateText(opts: {
    messages: WorkflowMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<WorkflowGenerateTextResult>;

  generateStructured<T>(
    opts: WorkflowGenerateStructuredOptions<T>,
  ): Promise<WorkflowGenerateStructuredResult<T>>;

  analyzeDocument(
    opts: WorkflowAnalyzeDocumentOptions,
  ): Promise<WorkflowGenerateTextResult>;

  deleteRemoteArtifact(artifactId: string): Promise<void>;
}
