import { createHmac } from "node:crypto";

export interface SignedFetchOptions {
  url: string;
  body: unknown;
  secret: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const SIGNATURE_HEADER = "X-Signature-SHA256";

export async function signedFetch(opts: SignedFetchOptions): Promise<Response> {
  if (!opts.secret) {
    throw new Error("signed-fetch: secret is required (fail-closed)");
  }
  const rawBody = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  const signature = createHmac("sha256", opts.secret).update(rawBody).digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    return await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        ...opts.headers,
      },
      body: rawBody,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  // Use timingSafeEqual for constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

export const SIGNED_FETCH_HEADER = SIGNATURE_HEADER;
