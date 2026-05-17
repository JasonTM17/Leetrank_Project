import { signToken, type JWTPayload } from "@/lib/auth";
import { setCookie } from "./setup";

export async function loginAs(payload: Partial<JWTPayload> = {}): Promise<string> {
  const token = await signToken({
    userId: payload.userId ?? "user-1",
    email: payload.email ?? "user-1@test.local",
    username: payload.username ?? "user1",
    role: payload.role ?? "user",
  });
  setCookie("token", token);
  return token;
}

export function jsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(url, {
    method: "POST",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers as object) },
    body: JSON.stringify(body),
  });
}

export function plainRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

import type { NextRequest } from "next/server";

// Many route handlers type their parameter as NextRequest. The runtime
// surface they use (json(), nextUrl, headers, cookies) overlaps with
// Request, so we cast at the call site to satisfy the compiler.
export function asNextRequest(req: Request): NextRequest {
  // Add a nextUrl getter for routes that use request.nextUrl.searchParams.
  if (!("nextUrl" in req)) {
    Object.defineProperty(req, "nextUrl", {
      get() {
        return new URL(this.url);
      },
    });
  }
  return req as unknown as NextRequest;
}
