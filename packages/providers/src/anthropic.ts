/**
 * Anthropic provider adapter.
 * Uses @anthropic-ai/sdk with native PDF support, vision, and tool_use for structured output.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
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
import { zodToJsonSchema } from "./util.js";

export interface AnthropicAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly name = "anthropic";
  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    vision: true,
    pdfAnalysis: true,
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    caching: true,
  };

  private client: Anthropic;
  private defaultModel: string;

  constructor(config: AnthropicAdapterConfig, logger?: ProviderLogger) {
    super(logger);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: 0, // Retries are handled by BaseProviderAdapter
    });
    this.defaultModel = config.defaultModel ?? "claude-sonnet-4-20250514";
  }

  // ─── Text generation ──────────────────────────────────────────────────

  protected async doGenerateText(
    opts: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const model = opts.model ?? this.defaultModel;
    const { system, messages } = this.convertMessages(opts.messages);

    const response = await this.client.messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? 8_192,
        temperature: opts.temperature,
        system: system ?? undefined,
        messages,
      },
      { signal: opts.signal },
    );

    const usage = this.extractUsage(response.usage);
    this.trackUsage(usage);

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return {
      text,
      usage,
      model: response.model,
      finishReason: response.stop_reason ?? "unknown",
    };
  }

  // ─── Structured generation via tool_use ───────────────────────────────

  protected async doGenerateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const model = opts.model ?? this.defaultModel;
    const { system, messages } = this.convertMessages(opts.messages);
    const toolName = opts.schemaName ?? "structured_output";
    const jsonSchema = zodToJsonSchema(opts.schema);

    const response = await this.client.messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? 8_192,
        temperature: opts.temperature,
        system: system ?? undefined,
        messages,
        tools: [
          {
            name: toolName,
            description:
              opts.schemaDescription ?? "Provide structured output matching the schema.",
            input_schema: jsonSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: toolName },
      },
      { signal: opts.signal },
    );

    const usage = this.extractUsage(response.usage);
    this.trackUsage(usage);

    // Extract the tool_use block
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use",
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("Anthropic: expected tool_use block in response");
    }

    const data = this.validateSchema(toolUseBlock.input, opts.schema);

    return {
      data,
      usage,
      model: response.model,
      finishReason: response.stop_reason ?? "unknown",
    };
  }

  // ─── Document analysis ────────────────────────────────────────────────

  protected async doAnalyzeDocument(
    opts: AnalyzeDocumentOptions,
  ): Promise<GenerateTextResult> {
    const model = opts.model ?? this.defaultModel;

    const contentBlocks: ContentBlockParam[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: opts.documentMediaType as
            | "application/pdf"
            | "text/plain"
            | "text/html",
          data: opts.documentData,
        },
      } as ContentBlockParam,
      {
        type: "text",
        text: opts.prompt,
      },
    ];

    const response = await this.client.messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? 8_192,
        temperature: opts.temperature,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      },
      { signal: opts.signal },
    );

    const usage = this.extractUsage(response.usage);
    this.trackUsage(usage);

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return {
      text,
      usage,
      model: response.model,
      finishReason: response.stop_reason ?? "unknown",
    };
  }

  // ─── Remote artifact cleanup ──────────────────────────────────────────

  async deleteRemoteArtifact(_artifactId: string): Promise<void> {
    // Anthropic does not store files server-side; this is a no-op.
  }

  // ─── Message conversion ───────────────────────────────────────────────

  private convertMessages(messages: Message[]): {
    system: string | null;
    messages: MessageParam[];
  } {
    let system: string | null = null;
    const converted: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("\n");
        continue;
      }

      if (typeof msg.content === "string") {
        converted.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
        continue;
      }

      // Multi-part content
      const blocks: ContentBlockParam[] = [];
      for (const part of msg.content) {
        switch (part.type) {
          case "text":
            blocks.push({ type: "text", text: part.text });
            break;
          case "image": {
            // If it's a data URL, extract base64
            const dataMatch = part.url.match(
              /^data:([^;]+);base64,(.+)$/,
            );
            if (dataMatch) {
              blocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: dataMatch[1] as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                  data: dataMatch[2],
                },
              });
            } else {
              // URL-based image
              blocks.push({
                type: "image",
                source: {
                  type: "url",
                  url: part.url,
                },
              } as ContentBlockParam);
            }
            break;
          }
          case "document":
            blocks.push({
              type: "document",
              source: {
                type: "base64",
                media_type: part.mediaType as "application/pdf",
                data: part.data,
              },
            });
            break;
        }
      }

      converted.push({
        role: msg.role as "user" | "assistant",
        content: blocks,
      });
    }

    return { system, messages: converted };
  }

  // ─── Usage extraction ─────────────────────────────────────────────────

  private extractUsage(usage: Anthropic.Usage): TokenUsage {
    const usageRecord = usage as unknown as Record<string, number>;
    return {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: usageRecord.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usageRecord.cache_creation_input_tokens ?? 0,
    };
  }
}
