import { NextRequest } from "next/server";
import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { runCodeSchema } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// /run-code is the "try it before you submit" endpoint. The judge is
// expensive — uncapped anonymous traffic here trivially DoS's the
// service. RULES §4 mandates rate limits on compute-heavy endpoints.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    // Auth first — only logged-in users can hit the judge.
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user rate limit. The userId is reliable; the IP would be
    // spoofable behind a careless proxy.
    const limit = rateLimit(`run-code:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Rate limit exceeded. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = runCodeSchema.safeParse(body);
    if (!parsed.success) {
      // Surface the offending field name with the message — bare "Required"
      // gives external callers no clue which key they're missing.
      const issue = parsed.error.errors[0];
      const field = issue?.path?.join(".") ?? "input";
      const msg = issue?.message ?? "Invalid input";
      return Response.json(
        { error: msg.includes(field) ? msg : `${field}: ${msg}` },
        { status: 400 }
      );
    }

    const { code, language, testCases } = parsed.data;
    // When the caller omits testCases (e.g. the editor "Run" button) we still
    // want to exercise the code at least once. Fall back to a single empty
    // stdin/expected pair — the runner will return stdout under `actual`.
    const cases =
      testCases && testCases.length > 0
        ? testCases
        : [{ input: "", expected: "" }];
    const results = await executeCode({ code, language, testCases: cases });

    return Response.json({ results });
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    logger.error("run-code POST failed", { scope: "api/run-code", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
