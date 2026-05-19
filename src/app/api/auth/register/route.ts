import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

// RULES §4: rate-limit auth routes. Registration is a write path that
// allocates DB rows + runs bcrypt — uncapped traffic here is both a spam
// vector and a cheap CPU exhaustion attack.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;

// RULES §4: bcrypt cost ≥ 10 minimum, 12 for auth endpoints. The cost is
// a per-hash CPU tax; 12 is ~four-fold heavier than 10 and aligns with
// modern OWASP guidance.
const BCRYPT_COST = 12;

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Bug #19: validate the body before consuming a rate-limit slot. A
    // user with a typo shouldn't burn through the per-IP budget — zod
    // first, rateLimit second.
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return Response.json({ error: firstError }, { status: 400 });
    }

    const { email, username, password } = parsed.data;

    const ip = clientIp(request);
    const limit = rateLimit(`register:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? "Email" : "Username";
      return Response.json({ error: `${field} already in use` }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.user.create({
      data: { email, username, password: hashed },
    });

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
        createdAt: user.createdAt,
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
