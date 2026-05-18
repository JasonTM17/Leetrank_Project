import { NextRequest } from "next/server";
import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { runCodeSchema } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

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
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return Response.json({ error: firstError }, { status: 400 });
    }

    const { code, language, testCases } = parsed.data;
    const results = await executeCode({ code, language, testCases });

    return Response.json({ results });
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
