/**
 * Server-Sent Events stream for submission status updates.
 *
 * The submit flow already runs synchronously today (POST /api/submissions
 * blocks until the judge finishes), but we expose this stream now so the
 * upcoming async judge worker can publish without breaking the existing
 * UI contract: clients can subscribe immediately after POST and receive
 * the verdict regardless of whether judging finishes in 50ms or 50s.
 *
 * Format follows the EventSource spec — `data: <json>\n\n` per event.
 * `event: <name>` lines tag the type so clients can `addEventListener`.
 *
 * Today: polls the DB every second and emits when status flips. When the
 * worker queue lands, replace the poll with a Redis Pub/Sub subscription.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_DURATION_MS = 60_000;

export const dynamic = "force-dynamic";

/**
 * IMPORTANT: auth + lookup MUST happen BEFORE the ReadableStream is
 * constructed. Once the response body is a stream the Content-Type is
 * locked to text/event-stream and any JSON we emit looks like a parse
 * error to EventSource clients. The block below short-circuits with a
 * normal application/json response (Response.json default) on every
 * failure path before a single SSE byte is ever flushed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!submission) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }
  if (submission.userId !== session.userId && session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let lastStatus = submission.status;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const stopTimers = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pollTimer) clearInterval(pollTimer);
    heartbeatTimer = null;
    pollTimer = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          // Stream already closed by client disconnect; stop polling.
          stopTimers();
        }
      };
      const send = (event: string, data: unknown) => {
        safeEnqueue(encoder.encode(`event: ${event}\n`));
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const heartbeat = () => safeEnqueue(encoder.encode(`: ping\n\n`));

      send("status", { id: submission.id, status: lastStatus });

      const startedAt = Date.now();
      heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
      pollTimer = setInterval(async () => {
        try {
          const fresh = await prisma.submission.findUnique({
            where: { id },
            select: { status: true, runtime: true, error: true },
          });
          if (!fresh) return;
          if (fresh.status !== lastStatus) {
            lastStatus = fresh.status;
            send("status", { id, status: fresh.status, runtime: fresh.runtime, error: fresh.error });
          }
          if (fresh.status !== "pending" || Date.now() - startedAt > MAX_DURATION_MS) {
            stopTimers();
            send("done", { id });
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        } catch {
          // Swallow transient errors; another poll will retry.
        }
      }, POLL_INTERVAL_MS);

      // Client disconnect / request abort: tear down timers so we don't
      // leak intervals or keep hammering Prisma after the consumer is gone.
      request.signal.addEventListener("abort", () => {
        stopTimers();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      stopTimers();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
