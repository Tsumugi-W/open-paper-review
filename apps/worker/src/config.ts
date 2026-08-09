/**
 * Worker configuration.
 * Reads and validates all required environment variables on startup.
 */

// ─── Configuration Interface ───────────────────────────────────────────────

export interface WorkerConfig {
  /** Number of concurrent jobs the worker processes (default 2). */
  concurrency: number;
  /** Redis connection URL. */
  redisUrl: string;
  /** PostgreSQL connection URL. */
  databaseUrl: string;
  /** Local storage path for temporary files. */
  storagePath: string;
  /** Health check HTTP server port (default 3001). */
  healthPort: number;
  /** Queue name for review jobs. */
  queueName: string;
  /** Per-provider rate limits. */
  providerLimits: ProviderLimits;
}

export interface ProviderLimits {
  anthropic: ProviderRateLimit;
  openai: ProviderRateLimit;
  gemini: ProviderRateLimit;
  openrouter: ProviderRateLimit;
}

export interface ProviderRateLimit {
  /** Maximum concurrent requests to this provider. */
  maxConcurrency: number;
  /** Maximum requests per minute. */
  maxRpm: number;
}

// ─── Environment Variable Parsing ──────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer, got: "${raw}"`);
  }
  return parsed;
}

function parseProviderLimit(prefix: string): ProviderRateLimit {
  return {
    maxConcurrency: parseIntEnv(`${prefix}_MAX_CONCURRENCY`, 5),
    maxRpm: parseIntEnv(`${prefix}_MAX_RPM`, 60),
  };
}

// ─── Load Configuration ────────────────────────────────────────────────────

/**
 * Load and validate worker configuration from environment variables.
 * Throws on missing required variables.
 */
export function loadConfig(): WorkerConfig {
  return {
    concurrency: parseIntEnv("WORKER_CONCURRENCY", 2),
    redisUrl: requireEnv("REDIS_URL"),
    databaseUrl: requireEnv("DATABASE_URL"),
    storagePath: optionalEnv("STORAGE_PATH", "/tmp/opr-worker"),
    healthPort: parseIntEnv("HEALTH_PORT", 3001),
    queueName: optionalEnv("QUEUE_NAME", "review-jobs"),
    providerLimits: {
      anthropic: parseProviderLimit("ANTHROPIC"),
      openai: parseProviderLimit("OPENAI"),
      gemini: parseProviderLimit("GEMINI"),
      openrouter: parseProviderLimit("OPENROUTER"),
    },
  };
}
