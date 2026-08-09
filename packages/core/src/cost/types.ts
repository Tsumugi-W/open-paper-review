export interface PricingEntry {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
}

export interface CostEstimate {
  estimatedTotalUsd: number;
  breakdown: StageEstimate[];
  assumptions: string[];
  currency: 'USD';
}

export interface StageEstimate {
  stage: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  parallelCalls: number;
}
