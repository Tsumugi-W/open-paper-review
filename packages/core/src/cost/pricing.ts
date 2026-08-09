import type { PricingEntry } from './types.js';

export const PRICING_TABLE: PricingEntry[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.50, outputPer1M: 10.00 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.60 },
  { provider: 'openai', model: 'gpt-4.1', inputPer1M: 2.00, outputPer1M: 8.00 },
  { provider: 'openai', model: 'gpt-4.1-mini', inputPer1M: 0.40, outputPer1M: 1.60 },
  { provider: 'openai', model: 'gpt-4.1-nano', inputPer1M: 0.10, outputPer1M: 0.40 },
  { provider: 'openai', model: 'o3-mini', inputPer1M: 1.10, outputPer1M: 4.40 },

  // Anthropic
  { provider: 'anthropic', model: 'claude-sonnet-4-6', inputPer1M: 3.00, outputPer1M: 15.00, cachedInputPer1M: 0.30 },
  { provider: 'anthropic', model: 'claude-opus-4-8', inputPer1M: 15.00, outputPer1M: 75.00, cachedInputPer1M: 1.50 },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', inputPer1M: 0.80, outputPer1M: 4.00, cachedInputPer1M: 0.08 },

  // Google
  { provider: 'gemini', model: 'gemini-2.5-pro', inputPer1M: 1.25, outputPer1M: 10.00 },
  { provider: 'gemini', model: 'gemini-2.5-flash', inputPer1M: 0.15, outputPer1M: 0.60 },
  { provider: 'gemini', model: 'gemini-2.0-flash', inputPer1M: 0.10, outputPer1M: 0.40 },
];

export function getPricing(provider: string, model: string): PricingEntry | null {
  return PRICING_TABLE.find(p => p.provider === provider && p.model === model) ?? null;
}
