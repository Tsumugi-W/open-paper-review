import { OpenAIAdapter } from './openai.js';
import type { ProviderCapabilities } from './types.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterAdapter extends OpenAIAdapter {
  constructor(config: {
    apiKey: string;
    model: string;
    capabilities?: Partial<ProviderCapabilities>;
    siteUrl?: string;
    siteName?: string;
  }) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: OPENROUTER_BASE_URL,
      capabilities: {
        nativePdf: false,
        vision: true,
        structuredOutput: true,
        fileUpload: false,
        maxContextLength: 128000,
        maxOutputTokens: 4096,
        ...config.capabilities,
      },
      defaultHeaders: {
        'HTTP-Referer': config.siteUrl ?? 'https://open-paper-review.dev',
        'X-Title': config.siteName ?? 'OpenPaperReview',
      },
    });
  }

  override get name(): string {
    return 'openrouter';
  }

  override async deleteRemoteArtifact(_artifactId: string): Promise<void> {
    // OpenRouter does not store files server-side
  }
}
