import type { CostEstimate, StageEstimate } from './types.js';
import { getPricing } from './pricing.js';

interface EstimateInput {
  pageCount: number;
  scoreScaleSize: number;
  provider: string;
  model: string;
}

const TOKENS_PER_PAGE = 800;
const SPECIALIST_OUTPUT_TOKENS = 2000;
const CANDIDATE_OUTPUT_TOKENS = 3000;
const BASE_OUTPUT_TOKENS = 1500;

export class CostEstimator {
  estimate(input: EstimateInput): CostEstimate {
    const pricing = getPricing(input.provider, input.model);
    if (!pricing) {
      return {
        estimatedTotalUsd: 0,
        breakdown: [],
        assumptions: [`No pricing data for ${input.provider}/${input.model}`],
        currency: 'USD',
      };
    }

    const paperTokens = input.pageCount * TOKENS_PER_PAGE;
    const costPerInputToken = pricing.inputPer1M / 1_000_000;
    const costPerOutputToken = pricing.outputPer1M / 1_000_000;

    const stages: StageEstimate[] = [
      {
        stage: 'intake',
        estimatedInputTokens: paperTokens + 500,
        estimatedOutputTokens: BASE_OUTPUT_TOKENS,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'gate',
        estimatedInputTokens: paperTokens + 1000,
        estimatedOutputTokens: 1000,
        estimatedCostUsd: 0,
        parallelCalls: 3,
      },
      {
        stage: 'briefing',
        estimatedInputTokens: paperTokens + 1000,
        estimatedOutputTokens: 2500,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'related_work',
        estimatedInputTokens: paperTokens * 0.3 + 2000,
        estimatedOutputTokens: 2000,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'specialist_audits',
        estimatedInputTokens: paperTokens + 2000,
        estimatedOutputTokens: SPECIALIST_OUTPUT_TOKENS,
        estimatedCostUsd: 0,
        parallelCalls: 5,
      },
      {
        stage: 'score_prior',
        estimatedInputTokens: 3000,
        estimatedOutputTokens: 1000,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'score_candidates',
        estimatedInputTokens: paperTokens * 0.5 + 3000,
        estimatedOutputTokens: CANDIDATE_OUTPUT_TOKENS,
        estimatedCostUsd: 0,
        parallelCalls: input.scoreScaleSize,
      },
      {
        stage: 'candidate_selection',
        estimatedInputTokens: CANDIDATE_OUTPUT_TOKENS * input.scoreScaleSize + 2000,
        estimatedOutputTokens: 2000,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'synthesis',
        estimatedInputTokens: CANDIDATE_OUTPUT_TOKENS * 3 + 2000,
        estimatedOutputTokens: 4000,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'calibration',
        estimatedInputTokens: 5000,
        estimatedOutputTokens: 1500,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
      {
        stage: 'improvements',
        estimatedInputTokens: 4000,
        estimatedOutputTokens: 3000,
        estimatedCostUsd: 0,
        parallelCalls: 1,
      },
    ];

    let total = 0;
    for (const stage of stages) {
      const inputCost = stage.estimatedInputTokens * stage.parallelCalls * costPerInputToken;
      const outputCost = stage.estimatedOutputTokens * stage.parallelCalls * costPerOutputToken;
      stage.estimatedCostUsd = parseFloat((inputCost + outputCost).toFixed(4));
      total += stage.estimatedCostUsd;
    }

    return {
      estimatedTotalUsd: parseFloat(total.toFixed(4)),
      breakdown: stages,
      assumptions: [
        `Estimated ${TOKENS_PER_PAGE} tokens per page (${input.pageCount} pages)`,
        `${input.scoreScaleSize} score candidates (one per scale point)`,
        `5 parallel specialist audits`,
        `Pricing: ${input.provider}/${input.model}`,
        `No caching assumed (actual cost may be lower)`,
      ],
      currency: 'USD',
    };
  }
}
