// Per-account login rate-limit bucket with a "generation" counter.
//
// Bug #2: when a user fails login a few times then rotates their password
// via /api/auth/change-password, the per-IP login bucket is still hot —
// the next login (with the *new* password) trips 429 even though the
// credential is correct. The IP bucket is intentional spam-control, but
// after a known-good password change we should give the *account* a fresh
// budget.
//
// We can't reset an arbitrary key in lib/rate-limit (the Redis backend
// just landed and is off-limits). Instead we wrap the limiter with a
// generation counter: the bucket key embeds the current generation, and
// change-password bumps the generation, so subsequent calls land in a
// brand-new bucket. The previous bucket is left to GC harmlessly.
//
// Keys are scoped per-email (lowercased) so an attacker can't ride a
// rotation belonging to a different account.

const generationByEmail = new Map<string, number>();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function loginAccountKey(email: string): string {
  const e = normalize(email);
  const gen = generationByEmail.get(e) ?? 0;
  return `login:user:${e}:gen${gen}`;
}

export function bumpLoginBucketFor(email: string): void {
  const e = normalize(email);
  generationByEmail.set(e, (generationByEmail.get(e) ?? 0) + 1);
}

// Test helper — keeps tests isolated alongside _resetRateLimit().
export function _resetAuthBuckets(): void {
  generationByEmail.clear();
}
