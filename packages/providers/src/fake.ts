import type {
  ProviderAdapter,
  ProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  AnalyzeDocumentOptions,
} from './types.js';

export interface FakeResponse {
  text?: string;
  structured?: unknown;
}

export class FakeProvider implements ProviderAdapter {
  readonly name = 'fake';
  readonly capabilities: ProviderCapabilities = {
    nativePdf: true,
    vision: true,
    structuredOutput: true,
    fileUpload: true,
    maxContextLength: 1000000,
    maxOutputTokens: 100000,
  };

  private responses: FakeResponse[] = [];
  private callIndex = 0;
  private _calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(responses?: FakeResponse[]) {
    if (responses) this.responses = responses;
  }

  get calls() {
    return this._calls;
  }

  pushResponse(response: FakeResponse): void {
    this.responses.push(response);
  }

  pushResponses(responses: FakeResponse[]): void {
    this.responses.push(...responses);
  }

  reset(): void {
    this.responses = [];
    this.callIndex = 0;
    this._calls = [];
  }

  private getNextResponse(): FakeResponse {
    const response = this.responses[this.callIndex];
    if (!response) {
      throw new Error(`FakeProvider: no response configured for call index ${this.callIndex}`);
    }
    this.callIndex++;
    return response;
  }

  async generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
    this._calls.push({ method: 'generateText', args: [opts] });
    const response = this.getNextResponse();
    return {
      text: response.text ?? '',
      usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
      finishReason: 'stop',
    };
  }

  async generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
    this._calls.push({ method: 'generateStructured', args: [opts] });
    const response = this.getNextResponse();
    const data = (response.structured ?? response.text ?? {}) as T;

    if (opts.schema) {
      const parsed = opts.schema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`FakeProvider: structured response does not match schema: ${parsed.error.message}`);
      }
      return {
        data: parsed.data as T,
        usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
        finishReason: 'stop',
      };
    }

    return {
      data,
      usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
      finishReason: 'stop',
    };
  }

  async analyzeDocument(opts: AnalyzeDocumentOptions): Promise<GenerateTextResult> {
    this._calls.push({ method: 'analyzeDocument', args: [opts] });
    const response = this.getNextResponse();
    return {
      text: response.text ?? '',
      usage: { inputTokens: 200, outputTokens: 100, cachedTokens: 0 },
      finishReason: 'stop',
    };
  }

  async deleteRemoteArtifact(artifactId: string): Promise<void> {
    this._calls.push({ method: 'deleteRemoteArtifact', args: [artifactId] });
  }
}
