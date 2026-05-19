# 2026-05 Bug Sweep — Next.js Layer

Targeted hunt across `src/app/*`, `src/lib/*`, `src/components/*`. Out-of-scope
services (`services/auth-go`, `services/realtime-go`, `services/leaderboard-rust`,
`services/notifications-ruby`, `services/analytics-python`, `services/submissions-go`,
`services/problems-go`, `judge-service`) were not touched.

---

## Bugs Fixed

### BUG-API-2026-05-01: Private GET endpoints leak via shared caches

**Severity**: High. Per-user data could be cached by upstream proxies/CDNs
and served to a different user on the same edge node.

**Where**:
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/profile/route.ts` (GET)
- `src/app/api/admin/users/route.ts`
- `src/app/api/bookmarks/route.ts` (GET — both single + list)
- `src/app/api/submissions/route.ts` (GET list)
- `src/app/api/submissions/[id]/route.ts` (GET detail)

**Root cause**: `next.config.ts` ships `Cache-Control: private, no-store` for
`/dashboard` and `/admin` HTML routes, but the JSON `/api/*` endpoints these
pages call had no Cache-Control header. A misconfigured CDN or corporate
proxy could memoize a 200 response and serve user A's session data to
user B. The auth/sessions endpoint already had this header — extending the
pattern to every per-user endpoint that returns 200 with a session-scoped
body.

**Fix**: Every authenticated GET now returns
`Cache-Control: private, no-store`. Public reads (problems list, contests,
leaderboard, stats, tags, status) keep their existing public CDN cache
hints because the data is identical for every viewer.

---

## Verification

```
pnpm test       (vitest run)         119 files, 658 tests passing
pnpm typecheck  (tsc --noEmit)       clean for sweep changes; pre-existing
                                     TS2540 errors in auth-jwks.test.ts and
                                     env-prod.test.ts (NODE_ENV mutation)
                                     are NOT introduced by this sweep
pnpm build      (next build)         succeeds, all routes generate
```

---

## Out of Scope (Found, Not Touched)

These belong to other teams or are intentional design choices:

1. **Judge service unhealthy on local boot** — `docker-compose.local.yml` web
   depends on judge, judge healthcheck fails. Owned by judge-service team.
   Did not run live smoke tests because of this — verified via vitest +
   targeted handler tests instead.

2. **`auth-jwks.test.ts` and `env-prod.test.ts` mutate `process.env.NODE_ENV`**
   under TS5+ where it's now read-only. Pre-existing on `main`. Owned by
   identity team (auth-jwks tests target the JWKS path); the env-prod test
   should switch to `vi.stubEnv("NODE_ENV", "production")` like
   `setup.ts` does at line 8.

3. **`/api/chat` 503 fallback on missing N8N webhook** — already correctly
   falls back. Confirmed via code read; not a bug.

4. **Locale switcher cookie** — server action commits the choice; works as
   designed.

5. **Bookmarks page error handler** — uses standard Next.js `error.tsx`
   pattern; intentional.

---

## Related Fixes Already on `main` During the Sweep

While this sweep was in flight, other commits landed that fixed adjacent
issues. Documenting them here for reference (not changes by this team):

- `mode: "insensitive"` flag added to all `prisma.*.findMany({ contains })`
  predicates so Postgres LIKE matches case-insensitively. (search, users,
  problems, admin/problems.)
- `discussionVote` model + `aggregate: vi.fn()` added to the prisma test
  mock so discussion list/detail handlers don't 500 in vitest.
- Duplicate `MAX_REPLY_DEPTH`/`CommentRow`/`buildCommentTree` declarations
  removed from `src/app/api/discussions/[id]/route.ts`.

---

## Risk Notes

The Cache-Control change is non-breaking: clients that previously got no
header now get `private, no-store`. Browsers will not cache the response
beyond the current request, which is the intended behavior for per-user
data. No public caching is regressed — only private endpoints were touched.
