/**
 * Abstract base class for provider adapters.
 * Provides retry logic, token tracking, and JSON repair utilities.
 */

import type { z } from "zod";
import type {
  ProviderAdapter,
  ProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  AnalyzeDocumentOptions,
  TokenUsage,
} from "./types.js";

export { type ProviderAdapter, type ProviderCapabilities };

/** Errors considered transient and eligible for retry. */
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Maximum number of retry attempts for transient errors. */
const MAX_RETRIES = 2;

/** Base delay in ms for exponential backoff. */
const BASE_DELAY_MS = 1000;

export interface ProviderLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: ProviderLogger = {
  info(message, context) {
    console.info(`[provider] ${message}`, context ?? "");
  },
  warn(message, context) {
    console.warn(`[provider] ${message}`, context ?? "");
  },
  error(message, context) {
    console.error(`[provider] ${message}`, context ?? "");
  },
};

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected logger: ProviderLogger;
  private _totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  constructor(logger?: ProviderLogger) {
    this.logger = logger ?? defaultLogger;
  }

  /** Accumulated token usage across all calls. */
  get totalUsage(): Readonly<TokenUsage> {
    return { ...this._totalUsage };
  }

  /** Reset accumulated token usage. */
  resetUsage(): void {
    this._totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  // ─── Public interface ────────────────────────────────────────────────

  async generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
    return this.withRetry(() => this.doGenerateText(opts), opts.signal);
  }

  async generateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    return this.withRetry(() => this.doGenerateStructured(opts), opts.signal);
  }

  async analyzeDocument(
    opts: AnalyzeDocumentOptions,
  ): Promise<GenerateTextResult> {
    return this.withRetry(() => this.doAnalyzeDocument(opts), opts.signal);
  }

  abstract deleteRemoteArtifact(artifactId: string): Promise<void>;

  // ─── Abstract methods for subclasses ──────────────────────────────────

  protected abstract doGenerateText(
    opts: GenerateTextOptions,
  ): Promise<GenerateTextResult>;

  protected abstract doGenerateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>>;

  protected abstract doAnalyzeDocument(
    opts: AnalyzeDocumentOptions,
  ): Promise<GenerateTextResult>;

  // ─── Retry logic ─────────────────────────────────────────────────────

  protected async withRetry<R>(
    fn: () => Promise<R>,
    signal?: AbortSignal,
  ): Promise<R> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) {
        throw new Error("Request aborted");
      }

      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;

        if (!this.isTransientError(err)) {
          throw err;
        }

        if (attempt === MAX_RETRIES) {
          break;
        }

        const delay = this.getBackoffDelay(err, attempt);
        this.logger.warn("Transient error, retrying", {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs: delay,
          provider: this.name,
        });

        await this.sleep(delay, signal);
      }
    }

    throw lastError;
  }

  private isTransientError(err: unknown): boolean {
    if (err && typeof err === "object") {
      const status =
        (err as { status?: number }).status ??
        (err as { statusCode?: number }).statusCode;
      if (status && TRANSIENT_STATUS_CODES.has(status)) {
        return true;
      }
      // Some SDKs wrap with a code property
      const code = (err as { code?: string }).code;
      if (code === "ECONNRESET" || code === "ETIMEDOUT") {
        return true;
      }
    }
    return false;
  }

  private getBackoffDelay(err: unknown, attempt: number): number {
    // Respect Retry-After header if present
    if (err && typeof err === "object") {
      const headers = (err as { headers?: Record<string, string> }).headers;
      const retryAfter = headers?.["retry-after"];
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (!Number.isNaN(seconds)) {
          return seconds * 1000;
        }
      }
    }
    // Exponential backoff: 1s, 2s
    return BASE_DELAY_MS * Math.pow(2, attempt);
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Request aborted"));
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("Request aborted"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  // ─── Token tracking ──────────────────────────────────────────────────

  protected trackUsage(usage: Partial<TokenUsage>): void {
    this._totalUsage.inputTokens += usage.inputTokens ?? 0;
    this._totalUsage.outputTokens += usage.outputTokens ?? 0;
    this._totalUsage.cacheReadTokens += usage.cacheReadTokens ?? 0;
    this._totalUsage.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
  }

  // ─── Schema validation ────────────────────────────────────────────────

  /**
   * Validate parsed data against a Zod schema.
   * Throws a descriptive error if validation fails.
   */
  protected validateSchema<T>(data: unknown, schema: z.ZodType<T>): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(
        `Schema validation failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    return result.data;
  }

  // ─── JSON repair ─────────────────────────────────────────────────────

  /**
   * Attempt to parse JSON, with one repair attempt if it fails.
   * Handles common issues: trailing commas, unquoted keys, truncated output.
   */
  protected parseJsonWithRepair<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // One attempt at repair
      const repaired = this.repairJson(raw);
      return JSON.parse(repaired) as T;
    }
  }

  private repairJson(raw: string): string {
    let json = raw.trim();

    // Strip markdown code fences
    if (json.startsWith("```")) {
      json = json.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    // Remove trailing commas before } or ]
    json = json.replace(/,\s*([}\]])/g, "$1");

    // Try to close unclosed braces/brackets (truncated output)
    const openBraces = (json.match(/{/g) ?? []).length;
    const closeBraces = (json.match(/}/g) ?? []).length;
    const openBrackets = (json.match(/\[/g) ?? []).length;
    const closeBrackets = (json.match(/]/g) ?? []).length;

    // If the string ends mid-value, try truncating to last complete property
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      // Remove trailing incomplete key-value pair
      json = json.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
      // Close remaining braces/brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        json += "]";
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        json += "}";
      }
    }

    return json;
  }
}
