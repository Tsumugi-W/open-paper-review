/**
 * Simple HTTP health check server.
 * Exposes /healthz (liveness) and /readyz (readiness) endpoints.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { Redis } from "ioredis";

// ─── Health State ──────────────────────────────────────────────────────────

interface HealthState {
  redis: Redis | null;
  isProcessing: boolean;
  activeJobCount: number;
  queueBacklog: number;
}

const state: HealthState = {
  redis: null,
  isProcessing: false,
  activeJobCount: 0,
  queueBacklog: 0,
};

// ─── State Setters ─────────────────────────────────────────────────────────

export function setRedisClient(redis: Redis): void {
  state.redis = redis;
}

export function setProcessingState(isProcessing: boolean): void {
  state.isProcessing = isProcessing;
}

export function setActiveJobCount(count: number): void {
  state.activeJobCount = count;
}

export function setQueueBacklog(count: number): void {
  state.queueBacklog = count;
}

// ─── Server ────────────────────────────────────────────────────────────────

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const { url, method } = req;

  if (method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  switch (url) {
    case "/healthz":
      handleLiveness(res);
      break;
    case "/readyz":
      handleReadiness(res);
      break;
    default:
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
  }
}

function handleLiveness(res: ServerResponse): void {
  // Liveness: process is alive
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "ok",
    uptime: process.uptime(),
  }));
}

function handleReadiness(res: ServerResponse): void {
  const redisConnected = state.redis?.status === "ready";

  if (!redisConnected || !state.isProcessing) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "not_ready",
      redis: redisConnected ? "connected" : "disconnected",
      processing: state.isProcessing,
      activeJobs: state.activeJobCount,
      queueBacklog: state.queueBacklog,
    }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "ready",
    redis: "connected",
    processing: state.isProcessing,
    activeJobs: state.activeJobCount,
    queueBacklog: state.queueBacklog,
  }));
}

/**
 * Start the health check HTTP server.
 */
export function startHealthServer(port: number): Server {
  const server = createServer(handleRequest);

  server.listen(port, () => {
    console.log(`[worker] Health server listening on port ${port}`);
  });

  return server;
}
