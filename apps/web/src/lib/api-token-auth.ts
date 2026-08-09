/**
 * API token authentication middleware.
 * Validates Bearer tokens from the Authorization header.
 * Tokens are hashed with SHA-256 before database lookup.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { getDb, getApiTokenByHash, updateApiTokenLastUsed } from "@opr/db";
import type { Session } from "./auth";

// ─── Token Extraction ─────────────────────────────────────────────────────────

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if no valid Bearer token is found.
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  // Must be "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const token = parts[1];
  if (!token || token.length === 0) return null;

  return token;
}

// ─── Token Hashing ────────────────────────────────────────────────────────────

/**
 * Hash a raw API token with SHA-256 for database lookup.
 * The raw token is never stored - only the hash is persisted.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf-8").digest("hex");
}

// ─── Token Validation ─────────────────────────────────────────────────────────

/**
 * Validate an API token by looking up its hash in the database.
 * Returns a Session-compatible object if valid, null otherwise.
 *
 * Uses constant-time comparison to prevent timing attacks on the hash lookup.
 */
export async function validateApiToken(
  rawToken: string,
): Promise<Session | null> {
  const tokenHash = hashToken(rawToken);

  const db = getDb();
  const record = await getApiTokenByHash(db, tokenHash);

  if (!record) return null;

  // Constant-time verification of the hash (defense in depth - DB already matched)
  const storedHashBuffer = Buffer.from(record.tokenHash, "hex");
  const computedHashBuffer = Buffer.from(tokenHash, "hex");

  if (storedHashBuffer.length !== computedHashBuffer.length) return null;
  if (!timingSafeEqual(storedHashBuffer, computedHashBuffer)) return null;

  // Update last used timestamp (fire and forget, suppress errors)
  updateApiTokenLastUsed(db, record.id).catch(() => {});

  // Return a session-compatible object
  return {
    userId: record.user.id,
    email: record.user.email,
    role: record.user.role as "admin" | "member",
    expiresAt: Number.MAX_SAFE_INTEGER, // API tokens don't expire via session mechanism
  };
}
