import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const updateProfileSchema = z.object({
  bio: z.string().max(500, "Bio must be 500 characters or fewer").optional(),
  avatar: z.string().url("Avatar must be a URL").optional().or(z.literal("")),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// GET returns the current user's public profile (no email — this endpoint
// mirrors what /api/users/{username} exposes, scoped to the signed-in user).
// /api/auth/me is the private "session inspector" (includes email, role); this
// is the symmetric read counterpart to PATCH for editing public fields.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(
      { user },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("auth/profile GET failed", { scope: "api/auth/profile", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`profile:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many profile updates. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Treat empty-string avatar as a clear (set to null) so the form can
    // implement "remove avatar" without a separate endpoint.
    const data: Record<string, string | null> = {};
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
    if (parsed.data.avatar !== undefined) {
      data.avatar = parsed.data.avatar === "" ? null : parsed.data.avatar;
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    return Response.json({ user });
  } catch (err) {
    logger.error("auth/profile PATCH failed", { scope: "api/auth/profile", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
