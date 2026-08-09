/**
 * Encryption utilities for API key storage.
 * Uses AES-256-GCM with the ENCRYPTION_KEY from environment.
 * Format: base64(iv[12] + ciphertext + authTag[16])
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

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

// ─── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext API key using AES-256-GCM.
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

  // Combine: iv + ciphertext + authTag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

// ─── Decryption ───────────────────────────────────────────────────────────────

/**
 * Decrypts an API key that was encrypted with AES-256-GCM.
 * Expects base64(iv[12] + ciphertext + authTag[16])
 */
export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(ciphertext, "base64");

  if (raw.length < 28) {
    // Minimum: 12 (iv) + 0 (empty ciphertext) + 16 (authTag)
    throw new Error("Invalid ciphertext: too short");
  }

  // Extract components
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
