import type { ZodSchema } from "zod";

// ─── Message Types ───────────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  mimeType: string;
  data: string; // base64-encoded
}

export type MessageContent = TextContent | ImageContent;

export interface Message {
  role: MessageRole;
  content: string | MessageContent[];
}

// ─── Document Input ──────────────────────────────────────────────────────────

export type DocumentInputType = "pdf" | "image" | "text";

export interface DocumentInput {
  type: DocumentInputType;
  /** Display name / filename */
  name: string;
  /** Raw binary content (Buffer/Uint8Array) or base64-encoded string */
  data: Uint8Array | string;
  mimeType: string;
  /** Provider-specific remote artifact id (e.g. Gemini file URI) */
  remoteArtifactId?: string;
}

// ─── Token Usage ─────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface GenerateTextResult {
  text: string;
  usage: TokenUsage;
  finishReason: "stop" | "length" | "content_filter" | "error";
  /** Provider-specific metadata */
  meta?: Record<string, unknown>;
}

export interface GenerateStructuredResult<T> {
  data: T;
  usage: TokenUsage;
  finishReason: "stop" | "length" | "content_filter" | "error";
  /** Raw text before parsing (useful for debugging) */
  rawText?: string;
  meta?: Record<string, unknown>;
}

// ─── Provider Capabilities ───────────────────────────────────────────────────

export interface ProviderCapabilities {
  nativePdf: boolean;
  vision: boolean;
  structuredOutput: boolean;
  fileUpload: boolean;
  maxContextLength: number;
  maxOutputTokens: number;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GenerateTextOptions {
  systemPrompt: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  schema: ZodSchema<T>;
  retryOnParseFail?: boolean;
}

export interface AnalyzeDocumentOptions {
  systemPrompt: string;
  messages: Message[];
  documents: DocumentInput[];
  temperature?: number;
}

// ─── Provider Adapter ────────────────────────────────────────────────────────

export interface ProviderAdapter {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  generateText(opts: GenerateTextOptions): Promise<GenerateTextResult>;
  generateStructured<T>(
    opts: GenerateStructuredOptions<T>
  ): Promise<GenerateStructuredResult<T>>;
  analyzeDocument(opts: AnalyzeDocumentOptions): Promise<GenerateTextResult>;
  deleteRemoteArtifact(artifactId: string): Promise<void>;
}
