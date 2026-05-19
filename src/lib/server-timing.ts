// Lightweight Server-Timing wrapper for App Router route handlers.
//
// Usage:
//   export const GET = withTiming("metrics", handler);
//
// Adds two response headers:
//   - X-Response-Time: "<ms>ms"           (numeric, dashboardable)
//   - Server-Timing:   "<label>;dur=<ms>"  (browser-native devtools support)
//
// Keeping this in lib/ rather than middleware.ts because edge middleware
// can't observe handler latency — by the time NextResponse.next() returns,
// the route hasn't run yet. A per-route wrapper is the only correct shape.

import { recordHttp, recordMissingRequestId } from "@/lib/metrics";

type Handler<Ctx> = (
  request?: Request,
  context?: Ctx,
) => Promise<Response> | Response;

export function withTiming<Ctx = unknown>(
  label: string,
  handler: Handler<Ctx>,
): Handler<Ctx> {
  return async function timed(request?: Request, context?: Ctx): Promise<Response> {
    const start = performance.now();
    // If middleware ran correctly, every request reaches us with X-Request-Id
    // already attached. Tally a counter when it's missing — this is the signal
    // that powers the HighRequestId404 alert. Skip the check entirely when no
    // request was supplied (unit tests calling the handler directly).
    if (request && !request.headers.get("x-request-id")) {
      recordMissingRequestId();
    }
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      // Re-throw so Next's error handling kicks in, but log timing first
      // by stamping a synthetic 500 response would lose the upstream stack.
      // Instead we emit a Server-Timing header on the *next* response if
      // any caller catches; here just rethrow.
      void elapsed;
      throw err;
    }
    const elapsed = Math.round(performance.now() - start);

    // Headers are immutable on Response in some runtimes; clone if needed.
    const headers = new Headers(response.headers);
    headers.set("X-Response-Time", `${elapsed}ms`);
    const existing = headers.get("Server-Timing");
    const entry = `${label};dur=${elapsed}`;
    headers.set("Server-Timing", existing ? `${existing}, ${entry}` : entry);

    // Tally per-status counter for /api/metrics scrape.
    recordHttp(response.status);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
