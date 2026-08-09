/**
 * OpenAI provider adapter.
 * Uses the openai SDK with support for structured output, vision, and file upload.
 */

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";
import { BaseProviderAdapter, type ProviderLogger } from "./base.js";
import type {
  ProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  AnalyzeDocumentOptions,
  TokenUsage,
  Message,
  ContentPart,
} from "./types.js";

export interface OpenAIAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  organization?: string;
}

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly name = "openai";
  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    vision: true,
    pdfAnalysis: true,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    caching: false,
  };

  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAIAdapterConfig, logger?: ProviderLogger) {
    super(logger);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      maxRetries: 0, // Retries are handled by BaseProviderAdapter
    });
    this.defaultModel = config.defaultModel ?? "gpt-4o";
  }

  // ─── Text generation ──────────────────────────────────────────────────

  protected async doGenerateText(
    opts: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const model = opts.model ?? this.defaultModel;
    const messages = this.convertMessages(opts.messages);

    const response = await this.client.chat.completions.create(
      {
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      },
      { signal: opts.signal },
    );

    const usage = this.extractUsage(response.usage);
    this.trackUsage(usage);

    return {
      text: response.choices[0]?.message?.content ?? "",
      usage,
      model: response.model,
      finishReason: response.choices[0]?.finish_reason ?? "unknown",
    };
  }

  // ─── Structured generation ────────────────────────────────────────────

  protected async doGenerateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const model = opts.model ?? this.defaultModel;
    const messages = this.convertMessages(opts.messages);

    const response = await this.client.chat.completions.create(
      {
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        response_format: zodResponseFormat(
          opts.schema as Parameters<typeof zodResponseFormat>[0],
          opts.schemaName ?? "response",
        ),
      },
      { signal: opts.signal },
    );

    const usage = this.extractUsage(response.usage);
    this.trackUsage(usage);

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    const parsed = this.parseJsonWithRepair<unknown>(rawContent);
    const data = this.validateSchema(parsed, opts.schema);

    return {
      data,
      usage,
      model: response.model,
      finishReason: response.choices[0]?.finish_reason ?? "unknown",
    };
  }

  // ─── Document analysis ────────────────────────────────────────────────

  protected async doAnalyzeDocument(
    opts: AnalyzeDocumentOptions,
  ): Promise<GenerateTextResult> {
    const model = opts.model ?? this.defaultModel;
    let fileId = opts.remoteFileId;
    let uploadedLocally = false;

    try {
      // Upload file if not already uploaded
      if (!fileId) {
        const buffer = Buffer.from(opts.documentData, "base64");
        const file = new File([buffer], "document.pdf", {
          type: opts.documentMediaType,
        });
        const uploaded = await this.client.files.create(
          { file, purpose: "assistants" },
          { signal: opts.signal },
        );
        fileId = uploaded.id;
        uploadedLocally = true;
      }

      // Send document as inline data URI via vision
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: opts.prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${opts.documentMediaType};base64,${opts.documentData}`,
              },
            },
          ],
        },
      ];

      const response = await this.client.chat.completions.create(
        {
          model,
          messages,
          temperature: opts.temperature,
          max_tokens: opts.maxTokens ?? 16_384,
        },
        { signal: opts.signal },
      );

      const usage = this.extractUsage(response.usage);
      this.trackUsage(usage);

      return {
        text: response.choices[0]?.message?.content ?? "",
        usage,
        model: response.model,
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      };
    } finally {
      // Clean up locally uploaded files
      if (uploadedLocally && fileId) {
        await this.safeDeleteFile(fileId);
      }
    }
  }

  // ─── Remote artifact cleanup ──────────────────────────────────────────

  async deleteRemoteArtifact(artifactId: string): Promise<void> {
    await this.safeDeleteFile(artifactId);
  }

  private async safeDeleteFile(fileId: string): Promise<void> {
    try {
      await this.client.files.del(fileId);
    } catch (err) {
      this.logger.warn("Failed to delete remote file", {
        fileId,
        provider: this.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Message conversion ───────────────────────────────────────────────

  private convertMessages(messages: Message[]): ChatCompletionMessageParam[] {
    const result: ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        if (msg.role === "system") {
          result.push({ role: "system", content: msg.content });
        } else if (msg.role === "assistant") {
          result.push({ role: "assistant", content: msg.content });
        } else {
          result.push({ role: "user", content: msg.content });
        }
        continue;
      }

      // Multi-part content
      const parts: ChatCompletionContentPart[] = msg.content.map(
        (part: ContentPart) => {
          switch (part.type) {
            case "text":
              return { type: "text" as const, text: part.text };
            case "image":
              return {
                type: "image_url" as const,
                image_url: { url: part.url },
              };
            case "document":
              // Convert document to image_url with data URI for PDF
              return {
                type: "image_url" as const,
                image_url: {
                  url: `data:${part.mediaType};base64,${part.data}`,
                },
              };
          }
        },
      );

      if (msg.role === "user") {
        result.push({ role: "user", content: parts });
      } else if (msg.role === "assistant") {
        // Assistant messages don't support content parts in OpenAI, extract text
        const text = parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("");
        result.push({ role: "assistant", content: text });
      } else {
        // System with parts - extract text
        const text = parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("\n");
        result.push({ role: "system", content: text });
      }
    }

    return result;
  }

  // ─── Usage extraction ─────────────────────────────────────────────────

  private extractUsage(
    usage: OpenAI.Completions.CompletionUsage | undefined,
  ): TokenUsage {
    return {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }
}
