/**
 * Gemini provider adapter.
 * Uses @google/generative-ai with native PDF/vision via inline data and
 * structured output via responseSchema.
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type Content,
  type Part,
  type GenerateContentResult,
  type InlineDataPart,
  SchemaType,
} from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
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

export interface GeminiAdapterConfig {
  apiKey: string;
  defaultModel?: string;
}

export class GeminiAdapter extends BaseProviderAdapter {
  readonly name = "gemini";
  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    vision: true,
    pdfAnalysis: true,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 8_192,
    caching: true,
  };

  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private defaultModel: string;
  private apiKey: string;

  constructor(config: GeminiAdapterConfig, logger?: ProviderLogger) {
    super(logger);
    this.apiKey = config.apiKey;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.fileManager = new GoogleAIFileManager(config.apiKey);
    this.defaultModel = config.defaultModel ?? "gemini-2.0-flash";
  }

  // ─── Text generation ──────────────────────────────────────────────────

  protected async doGenerateText(
    opts: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const modelName = opts.model ?? this.defaultModel;
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
      },
    });

    const { systemInstruction, contents } = this.convertMessages(opts.messages);

    const result = await model.generateContent({
      contents,
      systemInstruction: systemInstruction
        ? { role: "user", parts: [{ text: systemInstruction }] }
        : undefined,
    });

    const usage = this.extractUsage(result);
    this.trackUsage(usage);

    const text = result.response.text();

    return {
      text,
      usage,
      model: modelName,
      finishReason: this.mapFinishReason(result),
    };
  }

  // ─── Structured generation ────────────────────────────────────────────

  protected async doGenerateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const modelName = opts.model ?? this.defaultModel;
    const jsonSchema = zodToJsonSchema(opts.schema);

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        responseMimeType: "application/json",
        responseSchema: this.convertToGeminiSchema(jsonSchema),
      },
    });

    const { systemInstruction, contents } = this.convertMessages(opts.messages);

    const result = await model.generateContent({
      contents,
      systemInstruction: systemInstruction
        ? { role: "user", parts: [{ text: systemInstruction }] }
        : undefined,
    });

    const usage = this.extractUsage(result);
    this.trackUsage(usage);

    const rawText = result.response.text();
    const parsed = this.parseJsonWithRepair<unknown>(rawText);
    const data = this.validateSchema(parsed, opts.schema);

    return {
      data,
      usage,
      model: modelName,
      finishReason: this.mapFinishReason(result),
    };
  }

  // ─── Document analysis ────────────────────────────────────────────────

  protected async doAnalyzeDocument(
    opts: AnalyzeDocumentOptions,
  ): Promise<GenerateTextResult> {
    const modelName = opts.model ?? this.defaultModel;
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens ?? 8_192,
      },
    });

    // Use inline data for PDFs
    const parts: Part[] = [
      {
        inlineData: {
          mimeType: opts.documentMediaType,
          data: opts.documentData,
        },
      } as InlineDataPart,
      { text: opts.prompt },
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const usage = this.extractUsage(result);
    this.trackUsage(usage);

    const text = result.response.text();

    return {
      text,
      usage,
      model: modelName,
      finishReason: this.mapFinishReason(result),
    };
  }

  // ─── Remote artifact cleanup ──────────────────────────────────────────

  async deleteRemoteArtifact(artifactId: string): Promise<void> {
    try {
      await this.fileManager.deleteFile(artifactId);
    } catch (err) {
      this.logger.warn("Failed to delete remote file", {
        artifactId,
        provider: this.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Message conversion ───────────────────────────────────────────────

  private convertMessages(messages: Message[]): {
    systemInstruction: string | null;
    contents: Content[];
  } {
    let systemInstruction: string | null = null;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("\n");
        continue;
      }

      const role = msg.role === "assistant" ? "model" : "user";

      if (typeof msg.content === "string") {
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
        continue;
      }

      const parts: Part[] = msg.content.map((part: ContentPart) => {
        switch (part.type) {
          case "text":
            return { text: part.text };
          case "image": {
            const dataMatch = part.url.match(
              /^data:([^;]+);base64,(.+)$/,
            );
            if (dataMatch) {
              return {
                inlineData: {
                  mimeType: dataMatch[1],
                  data: dataMatch[2],
                },
              } as InlineDataPart;
            }
            // For URL-based images, we'd need to fetch - use fileData
            return { text: `[Image: ${part.url}]` };
          }
          case "document":
            return {
              inlineData: {
                mimeType: part.mediaType,
                data: part.data,
              },
            } as InlineDataPart;
        }
      });

      contents.push({ role, parts });
    }

    return { systemInstruction, contents };
  }

  // ─── Usage extraction ─────────────────────────────────────────────────

  private extractUsage(result: GenerateContentResult): TokenUsage {
    const metadata = result.response.usageMetadata;
    return {
      inputTokens: metadata?.promptTokenCount ?? 0,
      outputTokens: metadata?.candidatesTokenCount ?? 0,
      cacheReadTokens: metadata?.cachedContentTokenCount ?? 0,
      cacheWriteTokens: 0,
    };
  }

  // ─── Finish reason mapping ────────────────────────────────────────────

  private mapFinishReason(result: GenerateContentResult): string {
    const candidate = result.response.candidates?.[0];
    if (!candidate?.finishReason) return "unknown";
    switch (candidate.finishReason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      default:
        return candidate.finishReason.toLowerCase();
    }
  }

  // ─── Schema conversion for Gemini ─────────────────────────────────────

  private convertToGeminiSchema(
    jsonSchema: Record<string, unknown>,
  ): Record<string, unknown> {
    // Gemini expects a slightly different schema format using SchemaType enum
    return this.transformSchemaNode(jsonSchema);
  }

  private transformSchemaNode(
    node: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (node.type) {
      result.type = this.mapSchemaType(node.type as string);
    }

    if (node.properties) {
      const props = node.properties as Record<string, Record<string, unknown>>;
      result.properties = Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          this.transformSchemaNode(value),
        ]),
      );
    }

    if (node.items) {
      result.items = this.transformSchemaNode(
        node.items as Record<string, unknown>,
      );
    }

    if (node.required) {
      result.required = node.required;
    }

    if (node.enum) {
      result.enum = node.enum;
    }

    if (node.description) {
      result.description = node.description;
    }

    if (node.anyOf) {
      result.anyOf = (node.anyOf as Record<string, unknown>[]).map((s) =>
        this.transformSchemaNode(s),
      );
    }

    return result;
  }

  private mapSchemaType(type: string): string {
    switch (type) {
      case "string":
        return SchemaType.STRING;
      case "number":
        return SchemaType.NUMBER;
      case "integer":
        return SchemaType.INTEGER;
      case "boolean":
        return SchemaType.BOOLEAN;
      case "array":
        return SchemaType.ARRAY;
      case "object":
        return SchemaType.OBJECT;
      default:
        return type;
    }
  }
}
