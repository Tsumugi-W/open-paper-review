/**
 * Provider adapter types.
 * These mirror what @opr/core will eventually export, defined locally
 * until that package is built.
 */

import type { z } from "zod";

// ─── Token usage ────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// ─── Message types ──────────────────────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  /** Data URL or HTTP(S) URL. */
  url: string;
  mediaType?: string;
}

export interface DocumentContent {
  type: "document";
  /** Base64-encoded document data. */
  data: string;
  mediaType: string;
  /** Optional remote file identifier for cleanup. */
  remoteId?: string;
}

export type ContentPart = TextContent | ImageContent | DocumentContent;

export interface Message {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

// ─── Options and results ────────────────────────────────────────────────

export interface GenerateTextOptions {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateTextResult {
  text: string;
  usage: TokenUsage;
  model: string;
  finishReason: string;
}

export interface GenerateStructuredOptions<T = unknown> {
  messages: Message[];
  schema: z.ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateStructuredResult<T = unknown> {
  data: T;
  usage: TokenUsage;
  model: string;
  finishReason: string;
}

export interface AnalyzeDocumentOptions {
  /** Base64-encoded document content. */
  documentData: string;
  documentMediaType: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** If the file was already uploaded, its remote ID. */
  remoteFileId?: string;
}

// ─── Provider capabilities ──────────────────────────────────────────────

export interface ProviderCapabilities {
  /** Supports structured JSON output. */
  structuredOutput: boolean;
  /** Supports image inputs in messages. */
  vision: boolean;
  /** Supports native PDF document analysis. */
  pdfAnalysis: boolean;
  /** Maximum context window in tokens. */
  maxContextTokens: number;
  /** Maximum output tokens. */
  maxOutputTokens: number;
  /** Supports prompt caching. */
  caching: boolean;
}

// ─── Provider adapter interface ─────────────────────────────────────────

export interface ProviderAdapter {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  generateText(opts: GenerateTextOptions): Promise<GenerateTextResult>;
  generateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>>;
  analyzeDocument(opts: AnalyzeDocumentOptions): Promise<GenerateTextResult>;
  deleteRemoteArtifact(artifactId: string): Promise<void>;
}

// ─── Router types ───────────────────────────────────────────────────────

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface RouteRequirements {
  /** Requires structured output capability. */
  structuredOutput?: boolean;
  /** Requires vision capability. */
  vision?: boolean;
  /** Requires PDF analysis capability. */
  pdfAnalysis?: boolean;
  /** Minimum context window needed. */
  minContextTokens?: number;
  /** Preferred provider name, if available. */
  preferredProvider?: string;
}

export interface RateLimitConfig {
  /** Requests per minute. */
  requestsPerMinute: number;
  /** Tokens per minute. */
  tokensPerMinute: number;
}
