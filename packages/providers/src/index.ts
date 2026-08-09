/**
 * @opr/providers - Provider adapters for LLM APIs.
 *
 * Implements the ProviderAdapter interface for OpenAI, Anthropic, and Gemini,
 * with a router for automatic selection and fallback.
 */

// Types
export type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderConfig,
  RouteRequirements,
  RateLimitConfig,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  AnalyzeDocumentOptions,
  TokenUsage,
  Message,
  ContentPart,
  TextContent,
  ImageContent,
  DocumentContent,
} from "./types.js";

// Base
export { BaseProviderAdapter, type ProviderLogger } from "./base.js";

// Adapters
export { OpenAIAdapter, type OpenAIAdapterConfig } from "./openai.js";
export { AnthropicAdapter, type AnthropicAdapterConfig } from "./anthropic.js";
export { GeminiAdapter, type GeminiAdapterConfig } from "./gemini.js";

// OpenRouter
export { OpenRouterAdapter } from "./openrouter.js";

// Fake (for testing)
export { FakeProvider, type FakeResponse } from "./fake.js";

// Router
export { ProviderRouter, type ProviderRouterConfig } from "./router.js";

// Utilities
export { zodToJsonSchema } from "./util.js";
