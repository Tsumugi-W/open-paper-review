/**
 * Provider factory - Creates provider adapter instances from DB model profiles.
 * Handles API key decryption and maps provider enum values to adapter classes.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  OpenAIAdapter,
  AnthropicAdapter,
  GeminiAdapter,
  type ProviderAdapter,
} from "@opr/providers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelProfile {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "gemini" | "openrouter";
  model: string;
  apiKeyEncrypted: string;
  config?: Record<string, unknown> | null;
  isDefault: boolean;
}

// ─── Decryption ───────────────────────────────────────────────────────────────

/**
 * Decrypts an API key that was encrypted with AES-256-GCM.
 * Format: base64(iv[12] + ciphertext + authTag[16])
 */
export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(ciphertext, "base64");

  // Extract components: iv (12 bytes) | ciphertext | authTag (16 bytes)
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(raw.length - 16);
  const encrypted = raw.subarray(12, raw.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

/**
 * Encrypts an API key using AES-256-GCM.
 * Returns base64(iv[12] + ciphertext + authTag[16])
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

// ─── Key Management ───────────────────────────────────────────────────────────

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required. " +
          "Must be a 64-character hex string (32 bytes for AES-256).",
      );
    }
    _encryptionKey = Buffer.from(keyHex, "hex");
    if (_encryptionKey.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters) for AES-256.",
      );
    }
  }
  return _encryptionKey;
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

/**
 * Creates a ProviderAdapter instance from a database model profile.
 * Decrypts the stored API key and maps the provider enum to the correct adapter class.
 */
export function loadProviderFromProfile(profile: ModelProfile): ProviderAdapter {
  const apiKey = decryptApiKey(profile.apiKeyEncrypted);
  const config = (profile.config ?? {}) as Record<string, unknown>;

  switch (profile.provider) {
    case "openai":
      return new OpenAIAdapter({
        apiKey,
        defaultModel: profile.model,
        baseUrl: config.baseUrl as string | undefined,
        organization: config.organization as string | undefined,
      });

    case "anthropic":
      return new AnthropicAdapter({
        apiKey,
        defaultModel: profile.model,
        baseUrl: config.baseUrl as string | undefined,
      });

    case "gemini":
      return new GeminiAdapter({
        apiKey,
        defaultModel: profile.model,
      });

    case "openrouter":
      // OpenRouter uses OpenAI-compatible API with a custom base URL
      return new OpenAIAdapter({
        apiKey,
        defaultModel: profile.model,
        baseUrl: (config.baseUrl as string) ?? "https://openrouter.ai/api/v1",
      });

    default: {
      const _exhaustive: never = profile.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
