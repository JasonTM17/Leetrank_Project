import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { loginAccountKey } from "@/lib/auth-buckets";
import { logger } from "@/lib/logger";

// RULES §4: rate-limit auth routes. Switched from the local Map-based
// limiter to the shared lib/rate-limit helper so the GC + reset
// behaviour is consistent with /register and other write paths.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;

// Bug #2: a separate per-account bucket so a successful change-password
// can re-arm the user's login budget without resetting other callers
// hitting the same IP.
const ACCOUNT_LIMIT_MAX = 5;
const ACCOUNT_LIMIT_WINDOW_MS = 15 * 60_000;

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const limit = rateLimit(`login:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return Response.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // Bug #2: per-account bucket sits *behind* the per-IP bucket. A
    // change-password bumps the generation, so the very next login on
    // the rotated credential lands in a fresh budget.
    const accountLimit = rateLimit(
      loginAccountKey(email),
      ACCOUNT_LIMIT_MAX,
      ACCOUNT_LIMIT_WINDOW_MS
    );
    if (!accountLimit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((accountLimit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many login attempts for this account. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
    });

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error("login failed", { scope: "api/auth/login", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
