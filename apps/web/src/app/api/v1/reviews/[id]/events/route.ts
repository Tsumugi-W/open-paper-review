import { NextRequest } from "next/server";
import IORedis from "ioredis";
import { requireAuth } from "@/lib/auth";
import { getDb, getReviewJob } from "@opr/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Terminal statuses that mean the review won't produce more events. */
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/** Event types forwarded from the worker via Redis pub/sub. */
type ReviewEventType =
  | "stage_start"
  | "stage_complete"
  | "progress"
  | "error"
  | "completed"
  | "cancelled";

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  // Verify review exists and belongs to the user
  const db = getDb();
  const review = await getReviewJob(db, id);
  if (!review) {
    return new Response(JSON.stringify({ error: "Review not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Authorization: only the creator or admins can subscribe to events
  if (review.createdBy !== session.userId && session.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If review is already in a terminal state, return that immediately without opening a stream
  if (TERMINAL_STATUSES.has(review.status)) {
    return new Response(
      JSON.stringify({
        type: review.status,
        reviewId: id,
        status: review.status,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Create a dedicated Redis subscriber connection
      const subscriber = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      const channel = `review:${id}:events`;
      let isCleanedUp = false;

      // Cleanup function to unsubscribe and disconnect
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearInterval(heartbeat);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.disconnect();
      };

      // Handle incoming pub/sub messages
      subscriber.on("message", (ch: string, message: string) => {
        if (ch !== channel) return;
        try {
          const event = JSON.parse(message) as {
            type: ReviewEventType;
            [key: string]: unknown;
          };

          // Forward the event as SSE
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${message}\n\n`),
          );

          // If the review is done (completed/cancelled/error with fatal), close the stream
          if (event.type === "completed" || event.type === "cancelled") {
            cleanup();
            controller.close();
          }
        } catch {
          // Ignore malformed messages
        }
      });

      subscriber.on("error", () => {
        // Redis error - clean up silently
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Connect and subscribe
      subscriber
        .connect()
        .then(() => subscriber.subscribe(channel))
        .then(() => {
          // Send initial connection event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "connected", reviewId: id })}\n\n`,
            ),
          );
        })
        .catch(() => {
          // If we can't connect to Redis, send an error and close
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "Failed to connect to event stream" })}\n\n`,
              ),
            );
            controller.close();
          } catch {
            // Already closed
          }
        });

      // Heartbeat to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      }, 30000);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable proxy buffering (nginx)
    },
  });
}
