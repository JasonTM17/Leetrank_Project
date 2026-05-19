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
//
// Bug #8: a single corporate NAT can legitimately register multiple
// accounts; the previous 5-per-15-minutes ceiling tripped on a 2nd
// account from the same IP. Bumped to 5/hour per IP, with a separate
// per-email-prefix bucket so attackers can't churn the same mailbox
// even from a fresh IP.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;
const EMAIL_BUCKET_MAX = 3;
const EMAIL_BUCKET_WINDOW_MS = 60 * 60_000;

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

    // Per-IP bucket — covers naive scripted spam.
    const ip = clientIp(request);
    const ipLimit = rateLimit(`register:ip:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!ipLimit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Per-email-prefix bucket — protects against churning the *same*
    // mailbox while letting genuine 2nd accounts from the same IP through.
    const emailPrefix = email.split("@")[0]?.toLowerCase() ?? "";
    const emailLimit = rateLimit(
      `register:email:${emailPrefix}`,
      EMAIL_BUCKET_MAX,
      EMAIL_BUCKET_WINDOW_MS
    );
    if (!emailLimit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((emailLimit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many registration attempts for this email. Try again later." },
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
