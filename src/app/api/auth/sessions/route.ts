import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Read-only sessions list. We don't persist sessions in a table yet — the
// JWT is the source of truth — so for now we surface the current session as
// a single entry. When a Session model lands (in the identity service, per
// ADR-0030), this returns the full list verbatim. See ADR-0031 for the
// rationale on deferring multi-session listing.
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json(
      {
        sessions: [
          {
            userId: session.userId,
            username: session.username,
            role: session.role,
            current: true,
          },
        ],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("auth/sessions failed", { scope: "api/auth/sessions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
