import { NextRequest } from "next/server";
import { getSession } from "./auth";
import { rateLimit } from "./rate-limit";

/**
 * Shared admin-guard for /api/admin/* routes.
 *
 * Centralises the auth + role check + rate limit so every admin handler
 * gets the same posture. Keeps RULES §4 (rate-limit auth-adjacent and
 * compute-heavy endpoints) consistent without 8 copies of the same
 * boilerplate.
 *
 * Usage:
 *   const gate = await requireAdmin(request);
 *   if (!gate.ok) return gate.response;
 *   const { session } = gate;
 *
 * The rate limit is per-userId (the admin role is small enough that
 * IP-bucketing doesn't help). 60 admin actions/min is generous for
 * normal CMS use and tight enough to surface scripted abuse.
 */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export interface AdminGate {
  ok: true;
  session: { userId: string; email: string; username: string; role: string };
}

export interface AdminBlocked {
  ok: false;
  response: Response;
}

export async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request?: NextRequest
): Promise<AdminGate | AdminBlocked> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.role !== "admin") {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const limit = rateLimit(`admin:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return {
      ok: false,
      response: Response.json(
        { error: "Too many admin actions. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      ),
    };
  }

  return { ok: true, session };
}
