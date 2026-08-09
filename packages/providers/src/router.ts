/**
 * Provider router.
 * Selects the appropriate provider based on stage requirements, capabilities,
 * and availability. Handles fallback and rate limiting.
 */

import type {
  ProviderAdapter,
  RouteRequirements,
  RateLimitConfig,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  AnalyzeDocumentOptions,
} from "./types.js";
import type { ProviderLogger } from "./base.js";

interface RateLimitState {
  /** Timestamps of recent requests (within the last minute). */
  requestTimestamps: number[];
  /** Token counts of recent requests (within the last minute). */
  tokenCounts: { timestamp: number; tokens: number }[];
}

export interface ProviderRouterConfig {
  providers: ProviderAdapter[];
  rateLimits?: Record<string, RateLimitConfig>;
  logger?: ProviderLogger;
}

export class ProviderRouter {
  private providers: Map<string, ProviderAdapter>;
  private rateLimits: Map<string, RateLimitConfig>;
  private rateLimitState: Map<string, RateLimitState>;
  private logger: ProviderLogger;

  constructor(config: ProviderRouterConfig) {
    this.providers = new Map(
      config.providers.map((p) => [p.name, p]),
    );
    this.rateLimits = new Map(Object.entries(config.rateLimits ?? {}));
    this.rateLimitState = new Map();
    this.logger = config.logger ?? {
      info(msg, ctx) { console.info(`[router] ${msg}`, ctx ?? ""); },
      warn(msg, ctx) { console.warn(`[router] ${msg}`, ctx ?? ""); },
      error(msg, ctx) { console.error(`[router] ${msg}`, ctx ?? ""); },
    };

    // Initialize rate limit state for each provider
    for (const name of this.providers.keys()) {
      this.rateLimitState.set(name, {
        requestTimestamps: [],
        tokenCounts: [],
      });
    }
  }

  /**
   * Select the best provider for the given requirements.
   * Returns null if no provider meets requirements.
   */
  selectProvider(requirements: RouteRequirements): ProviderAdapter | null {
    const candidates = this.getCandidates(requirements);

    if (candidates.length === 0) {
      return null;
    }

    // Prefer the explicitly requested provider
    if (requirements.preferredProvider) {
      const preferred = candidates.find(
        (p) => p.name === requirements.preferredProvider,
      );
      if (preferred && !this.isRateLimited(preferred.name)) {
        return preferred;
      }
    }

    // Return the first candidate that isn't rate limited
    for (const candidate of candidates) {
      if (!this.isRateLimited(candidate.name)) {
        return candidate;
      }
    }

    // All candidates are rate limited - return the one with earliest availability
    return candidates[0] ?? null;
  }

  /**
   * Generate text with automatic fallback.
   * Tries the selected provider first, falls back to alternatives on failure.
   */
  async generateText(
    opts: GenerateTextOptions,
    requirements: RouteRequirements = {},
  ): Promise<GenerateTextResult & { provider: string }> {
    const candidates = this.getCandidates(requirements);
    return this.executeWithFallback(
      candidates,
      async (provider) => {
        const result = await provider.generateText(opts);
        this.recordRequest(provider.name, result.usage.inputTokens + result.usage.outputTokens);
        return { ...result, provider: provider.name };
      },
    );
  }

  /**
   * Generate structured output with automatic fallback.
   */
  async generateStructured<T>(
    opts: GenerateStructuredOptions<T>,
    requirements: RouteRequirements = {},
  ): Promise<GenerateStructuredResult<T> & { provider: string }> {
    const reqs: RouteRequirements = {
      ...requirements,
      structuredOutput: true,
    };
    const candidates = this.getCandidates(reqs);
    return this.executeWithFallback(
      candidates,
      async (provider) => {
        const result = await provider.generateStructured(opts);
        this.recordRequest(provider.name, result.usage.inputTokens + result.usage.outputTokens);
        return { ...result, provider: provider.name };
      },
    );
  }

  /**
   * Analyze a document with automatic fallback.
   */
  async analyzeDocument(
    opts: AnalyzeDocumentOptions,
    requirements: RouteRequirements = {},
  ): Promise<GenerateTextResult & { provider: string }> {
    const reqs: RouteRequirements = {
      ...requirements,
      pdfAnalysis: true,
    };
    const candidates = this.getCandidates(reqs);
    return this.executeWithFallback(
      candidates,
      async (provider) => {
        const result = await provider.analyzeDocument(opts);
        this.recordRequest(provider.name, result.usage.inputTokens + result.usage.outputTokens);
        return { ...result, provider: provider.name };
      },
    );
  }

  /**
   * Get a specific provider by name.
   */
  getProvider(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): ProviderAdapter[] {
    return Array.from(this.providers.values());
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private getCandidates(requirements: RouteRequirements): ProviderAdapter[] {
    const candidates: ProviderAdapter[] = [];

    for (const provider of this.providers.values()) {
      const caps = provider.capabilities;

      if (requirements.structuredOutput && !caps.structuredOutput) continue;
      if (requirements.vision && !caps.vision) continue;
      if (requirements.pdfAnalysis && !caps.pdfAnalysis) continue;
      if (
        requirements.minContextTokens &&
        caps.maxContextTokens < requirements.minContextTokens
      )
        continue;

      candidates.push(provider);
    }

    // Sort: preferred provider first, then by context window size (larger first)
    candidates.sort((a, b) => {
      if (
        requirements.preferredProvider &&
        a.name === requirements.preferredProvider
      )
        return -1;
      if (
        requirements.preferredProvider &&
        b.name === requirements.preferredProvider
      )
        return 1;
      return b.capabilities.maxContextTokens - a.capabilities.maxContextTokens;
    });

    return candidates;
  }

  private async executeWithFallback<R>(
    candidates: ProviderAdapter[],
    fn: (provider: ProviderAdapter) => Promise<R>,
  ): Promise<R> {
    if (candidates.length === 0) {
      throw new Error("No provider available for the given requirements");
    }

    let lastError: unknown;

    for (const provider of candidates) {
      if (this.isRateLimited(provider.name)) {
        this.logger.warn("Provider rate limited, trying fallback", {
          provider: provider.name,
        });
        continue;
      }

      try {
        return await fn(provider);
      } catch (err: unknown) {
        lastError = err;

        // Never fall back on abort - propagate immediately
        if (this.isAbortError(err)) {
          throw err;
        }

        this.logger.error("Provider failed, trying fallback", {
          provider: provider.name,
          error: err instanceof Error ? err.message : String(err),
          // Do not log paper content
        });

        // If it's a rate limit error, mark it
        if (this.isRateLimitError(err)) {
          this.markRateLimited(provider.name);
        }
      }
    }

    throw lastError ?? new Error("All providers failed");
  }

  // ─── Rate limiting ────────────────────────────────────────────────────

  private isRateLimited(providerName: string): boolean {
    const config = this.rateLimits.get(providerName);
    if (!config) return false;

    const state = this.rateLimitState.get(providerName);
    if (!state) return false;

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Clean up old entries
    state.requestTimestamps = state.requestTimestamps.filter(
      (t) => t > oneMinuteAgo,
    );
    state.tokenCounts = state.tokenCounts.filter(
      (t) => t.timestamp > oneMinuteAgo,
    );

    // Check requests per minute
    if (state.requestTimestamps.length >= config.requestsPerMinute) {
      return true;
    }

    // Check tokens per minute
    const totalTokens = state.tokenCounts.reduce(
      (sum, t) => sum + t.tokens,
      0,
    );
    if (totalTokens >= config.tokensPerMinute) {
      return true;
    }

    return false;
  }

  private recordRequest(providerName: string, tokens: number): void {
    const state = this.rateLimitState.get(providerName);
    if (!state) return;

    const now = Date.now();
    state.requestTimestamps.push(now);
    state.tokenCounts.push({ timestamp: now, tokens });
  }

  private markRateLimited(providerName: string): void {
    const state = this.rateLimitState.get(providerName);
    if (!state) return;

    // Fill up the request timestamps to ensure rate limit detection
    const config = this.rateLimits.get(providerName);
    if (config) {
      const now = Date.now();
      while (state.requestTimestamps.length < config.requestsPerMinute) {
        state.requestTimestamps.push(now);
      }
    }
  }

  private isAbortError(err: unknown): boolean {
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "Request aborted") {
        return true;
      }
    }
    return false;
  }

  private isRateLimitError(err: unknown): boolean {
    if (err && typeof err === "object") {
      const status =
        (err as { status?: number }).status ??
        (err as { statusCode?: number }).statusCode;
      return status === 429;
    }
    return false;
  }
}
