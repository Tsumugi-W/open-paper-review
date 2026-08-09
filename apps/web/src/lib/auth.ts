import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { extractToken, validateApiToken } from "./api-token-auth";

const SESSION_COOKIE = "opr_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface Session {
  userId: string;
  email: string;
  role: "admin" | "member";
  expiresAt: number;
}

/**
 * Hash a password using crypto.subtle with PBKDF2.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(hash);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  return Buffer.from(combined).toString("base64");
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const combined = Buffer.from(storedHash, "base64");
  const salt = combined.subarray(0, 16);
  const originalHash = combined.subarray(16);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(hash);
  if (hashArray.length !== originalHash.length) return false;
  return hashArray.every((byte, i) => byte === originalHash[i]);
}

/**
 * Create a session token and set it as a secure httpOnly cookie.
 */
export async function createSession(userId: string, email: string, role: "admin" | "member") {
  const session: Session = {
    userId,
    email,
    role,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  // In production, sign this with a secret or store in DB/Redis
  const token = Buffer.from(JSON.stringify(session)).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return session;
}

/**
 * Validate the current session from cookies. Returns null if invalid/expired.
 */
export async function validateSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session: Session = JSON.parse(
      Buffer.from(token, "base64url").toString()
    );
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Middleware: require valid auth for API routes. Returns session or null.
 * Checks both session cookie AND API token (Bearer header).
 * If cookie auth fails, falls back to API token auth.
 */
export async function requireAuth(request: NextRequest): Promise<Session | null> {
  // 1. Try session cookie first
  const session = await validateSession();
  if (session) return session;

  // 2. Fall back to API token (Bearer header)
  const token = extractToken(request);
  if (!token) return null;

  return validateApiToken(token);
}

/**
 * Middleware: require admin role.
 */
export async function requireAdmin(request: NextRequest): Promise<Session | null> {
  const session = await requireAuth(request);
  if (!session || session.role !== "admin") return null;
  return session;
}
