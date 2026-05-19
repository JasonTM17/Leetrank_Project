# Full QA Report — 2026-05-19

End-to-end QA pass of the LeetRank stack against local docker-compose
(`docker compose -f docker-compose.yml -f docker-compose.local.yml up -d`).
Every flow exercised against live services on `http://localhost:13000`
(Next.js web), `:14000` (Hono API), `:14001` (auth legacy), `:19090`
(Go judge). Evidence is reproducible with `curl` snippets stored
alongside each finding.

> Scope of this report: business-flow + UI-surface bugs only. Unit
> coverage and code style are out of scope and tracked separately.

## Summary

| Severity | Count | Notes                                     |
| -------- | ----: | ----------------------------------------- |
| P0       |     6 | Block launch / silent business breakage   |
| P1       |    14 | Bad UX, inconsistent contracts, surface gaps |
| P2       |    11 | Nits, polish, low blast radius            |

Total flows exercised: 47 (auth 12, problems 8, submissions 7,
contests 5, bookmarks 4, search 3, admin 3, profile 3, misc 2).

Stack snapshot at probe time:

| Service        | Port  | Health      | Notes                                  |
| -------------- | ----- | ----------- | -------------------------------------- |
| postgres       | 15432 | healthy     | seed loaded (10 problems, 1 contest)   |
| redis          | 16379 | healthy     | rate limiter back-end                  |
| app (Next.js)  | 13000 | healthy     | uptime 4h+                             |
| api (Hono)     | 14000 | healthy     |                                        |
| auth (Hono)    | 14001 | healthy     | `POST /login` is a 501 stub            |
| judge (Go)     | 19090 | **unhealthy** in compose, 200 to /health |
| identity (Go)  | 14011 | DOWN        | not booted — see API smoke report      |
| submissions    | 14012 | DOWN        | not booted                             |
| problems       | 14013 | DOWN        | not booted                             |

The three "not booted" Go services are tracked in `docs/testing/2026-05-API-TEST-REPORT.md` (Build failures section); the report below treats them as expected-down so we don't double-count.

---

## P0 — must fix before launch

### bug-1 — Two Sum judges WRONG_ANSWER for a textbook-correct solution

- Surface: `POST /api/submissions` against `cmpbd3lwz000ada4ohfvco1vw` (`/problems/two-sum`).
- Repro:
  1. Login as a fresh user.
  2. Submit the canonical `class Solution: def twoSum(self, nums, target): ...` body (returns indices summing to target).
  3. Poll `GET /api/submissions/{id}` until `status` leaves `queued`.
- Expected: `status: accepted`, runtime > 0, `output: null`, `error: null`.
- Actual: `status: wrong_answer`, runtime 128 ms, `output: null`, `error: null`. Same shape submitted as `def twoSum` (no class wrapper) also yields `wrong_answer`.
- Evidence (recorded run):
  ```json
  {"submission":{"id":"cmpch3f470008ok3fgzfgn7gc","status":"wrong_answer","runtime":128,"output":null,"error":null,...}}
  ```
- Why P0: This is the headline problem of the platform. A correct user solution cannot be made to pass — every demo will show "wrong answer" on Two Sum. Either the judge harness expects a different signature, or the seeded testcases are malformed. The verdict object also discards the `output` and `error` strings (both null), so the user cannot self-diagnose.
- Suspected root cause: testcase `input` is stored as the bare array string `["h","e","l","l","o"]` for reverse-string but Two Sum's seed uses `[[2,7,11,15],9]` — the harness probably expects either a function-call or stdin protocol that does not match the stored string for one of these problems. Confirm by running the seeded Two Sum testcase directly through the judge.

### bug-2 — Re-login after change-password is rate-limited (429) from the same IP

- Surface: `POST /api/auth/login`.
- Repro:
  1. Login as a fresh user (succeeds, 200).
  2. `POST /api/auth/change-password` with the correct old password (succeeds, 200).
  3. Immediately `POST /api/auth/login` with the new password.
- Expected: 200 with the new session cookie. UX flow is "settings → change password → re-auth".
- Actual: `429 {"error":"Too many login attempts. Try again later."}`. The user just changed their password and is now locked out for several minutes from a single browser tab.
- Evidence:
  ```
  chg-ok:200 {"success":true}
  relogin:429 {"error":"Too many login attempts. Try again later."}
  ```
- Why P0: Hard regression of password rotation. A user that changes their password is unable to re-authenticate without waiting. Either the rate limiter must skip the post-rotation login or change-password should atomically re-issue a fresh session.

### bug-3 — `/status` page renders 404 even though `src/app/status/page.tsx` exists

- Surface: `GET /status` (UI).
- Repro:
  1. `curl -i http://localhost:13000/status`
  2. Compare with `ls D:/LeetRank_Project/src/app/status` — file is present and exports a default page component.
- Expected: 200 with the live status page (recent commit `0e5e1d4 feat(status): public /status page with live service health`).
- Actual: `HTTP/1.1 404 Not Found` with `x-nextjs-cache: HIT` and `x-nextjs-prerender: 1` — Next.js prerendered the *not-found* fallback. The fetch to `/api/status` (line 114 of the page) likely throws on build because there is no `src/app/api/status/route.ts` (the file is `src/app/api/health/route.ts`).
- Why P0: A feature shipped to main on 2026-05-18 is dead in production. Marketing links to `/status` will break.
- Recommended fix: either create `/api/status` as an alias of `/api/health`, or change the page's fetch to `/api/health`. Then trigger a fresh build so the page exits the "not-found" pre-render bucket.

### bug-4 — `/api/run-code` schema rejects every realistic IDE call

- Surface: `POST /api/run-code` (the "Run" button on the editor).
- Repro:
  ```
  curl -b cookie -X POST /api/run-code -d '{"language":"python","code":"print(1)","input":""}'
  ```
- Expected: 200 with stdout. The button on `/problems/[slug]` is for free-form runs against user-typed input, not against hidden testcases.
- Actual: `400 {"error":"Required"}`. The Zod schema requires a `testCases` array. The error message does not name the missing field.
- Why P0: The Run button is visible on every problem page. With this schema, no client request from the editor can succeed without first knowing the testcases — which the editor doesn't have when the user is just probing their own code.
- Source: `src/app/api/run-code/route.ts:45` `const { code, language, testCases } = parsed.data;`

### bug-5 — `/api/submissions` POST surfaces opaque `"Required"` for missing field

- Surface: `POST /api/submissions`.
- Repro:
  ```
  curl -b cookie -X POST /api/submissions -d '{"problemId":"...","language":"python","sourceCode":"..."}'
  ```
- Expected: 400 with `{"error":"code is required"}` — the Zod schema's actual field is `code`, not `sourceCode`.
- Actual: `400 {"error":"Required"}`. No field name. The frontend uses `code`; an external caller hitting OpenAPI docs that list `sourceCode` will receive this and have no way to debug.
- Source: `src/app/api/submissions/route.ts:97` flattens to `parsed.error.errors[0]?.message` only.
- Why P0: This is a contract bug — the OpenAPI doc and the body schema disagree. Confirm by diffing `/api/openapi` (YAML at line 60+ of smoke-report) against the validation schema. Either rename the field everywhere or alias it.

### bug-6 — `/discussions` (list) returns 404; only `/discussions/[id]` exists

- Surface: `GET /discussions` (UI).
- Repro: `curl -i http://localhost:13000/discussions` → 404. `curl -i http://localhost:13000/discussions/cmpbd3lwz000ada4ohfvco1vw` → 200.
- Expected: a discussions hub / list page. `src/app/discussions/` only contains `[id]/`, no `page.tsx` at the root.
- Actual: bare 404. Anyone navigating to `/discussions` from the global nav, sitemap, or marketing copy lands on the not-found page.
- Why P0: Discussions are a shipped feature (the API exists at `/api/discussions?problemId=`), but the entry-point page is missing. Either delete the feature surface or build the list page.


---

## P1 — bad UX / inconsistencies

### bug-7 — Bookmark removal API has no documented DELETE; uses POST-toggle

- Surface: `DELETE /api/bookmarks/{problemId}` and `DELETE /api/bookmarks?problemId=...` both return 405 / 404.
- Actual contract: `POST /api/bookmarks` toggles — second POST on the same `problemId` deletes. There is no GET-delete-list-add-delete-list semantics.
- Evidence:
  ```
  DELETE /api/bookmarks/{id}   -> 404 (Next not-found page, not JSON)
  DELETE /api/bookmarks?id=... -> 405
  POST /api/bookmarks {id}     -> {"bookmarked":true}
  POST /api/bookmarks {id}     -> {"bookmarked":false}
  ```
- Recommendation: either expose a real `DELETE /api/bookmarks/[id]` or document the toggle contract in OpenAPI and the user-visible Bookmarks page.

### bug-8 — Registration rate limit is **too aggressive** and bypasses single-user UX

- Surface: `POST /api/auth/register`.
- Repro: register one user, then immediately register a second (different email/username, same IP).
- Expected: 201 — the rate limit window for "create account" should be larger than two requests per session.
- Actual: 429 `"Too many registration attempts. Try again later."` on the *second* call, even with a valid distinct email and username.
- Evidence:
  ```
  dup1:201
  dup2:429   (different email, different username)
  ```
- Why P1: Friend-of-tester demos break (one user creates two accounts to test the duplicate-email path) and shared-NAT users (offices, college labs) hit it instantly.

### bug-9 — Password rule advertised as "strength meter" but only enforces 6-char minimum

- Surface: `POST /api/auth/register`.
- Repro: `curl -d '{"password":"123"}'` → 400 "Password must be at least 6 characters".
- Expected (per home page copy): "field-level errors with strength meter".
- Actual: a single 6-char minimum. `password` is rejected with same length but `password` would have been accepted. No upper bound test, no number/symbol requirement, no breach check.
- Why P1: Marketing claim doesn't match implementation. UI may still render a meter that has no server-side teeth.

### bug-10 — `/api/auth/profile` exposes only PATCH; GET and PUT both 405

- Repro:
  ```
  GET  /api/auth/profile -> 405
  PUT  /api/auth/profile -> 405
  PATCH /api/auth/profile -> 200
  ```
- Expected: GET returns the editable profile blob (so the settings page can hydrate without refetching `/api/auth/me`).
- Actual: client must use `/api/auth/me` for read and `/api/auth/profile` for write. Two endpoints for one resource is asymmetric.

### bug-11 — `/api/auth/profile` accepts `avatar` as a free-form URL with no validation

- Repro: `PATCH /api/auth/profile -d '{"avatar":"https://example.test/a.png"}'` succeeds. `javascript:alert(1)` and other unsafe schemes were not exercised but the schema (per `validations.ts`) is `string()` without `.url()`.
- Why P1: open redirect / XSS surface if the avatar URL is rendered in `<img src>` without sanitisation. Add `.url().refine(http/https only)` and consider proxying through Vercel image optimizer.

### bug-12 — `/dashboard` and `/admin` are **fully prerendered** before auth

- Surface: `GET /dashboard` (anon) → 307 redirect.
- Followed authed: 200 with `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`, `Cache-Control: s-maxage=31536000`.
- Why P1: `s-maxage=31536000` (1 year) on an authenticated dashboard means a CDN that doesn't honor `Vary: Cookie` will serve User A's cache to User B. The fact that the page also has `x-nextjs-prerender: 1` suggests it's being baked at build time.
- Recommendation: mark `/dashboard/*` `dynamic = 'force-dynamic'` (or `revalidate = 0`) and remove the long s-maxage.

### bug-13 — `manifest.json` and `favicon.ico` both 404

- Repro:
  ```
  curl -i /manifest.json -> 404
  curl -i /favicon.ico  -> 404
  ```
- Expected: the home metadata block declares `application-name: LeetRank` and the navbar has a logo, but Chrome / Safari will keep retrying these for the PWA install prompt and tab-icon.
- Why P1: Lighthouse PWA score collapses; "add to home screen" silent-fails.

### bug-14 — `/api/leaderboard?page=999` returns 200 with an empty array

- Expected: a page beyond `total/limit` should clamp to the last valid page or 404. Returning an empty array masks pagination logic bugs.
- Actual: `{"leaderboard":[],"total":0,"page":999,"limit":10}` — note `total: 0` even though there are users registered (just none with submissions yet). `total` should reflect the eligible pool.

### bug-15 — `/api/leaderboard` reports `total: 0` while `/api/stats` reports `users: 6`

- Surface: contract drift between `/api/stats` (counts of every user) and `/api/leaderboard` (counts of users *with at least one solved problem*).
- Why P1: The dashboard "Active climbers" stat card and the leaderboard footer disagree on N — confusing for end users.
- Fix: leaderboard page should display "ranked players" wording, or stats endpoint should split `users` into `total` vs `ranked`.

### bug-16 — Submission verdict has no judge `output` or `error` fields populated

- After Two Sum and Reverse String submissions, `output: null, error: null` for both — even for `wrong_answer`. The judge must be returning per-test diffs in some form, but the API drops them on the floor.
- Why P1: Without a diff, users can't debug *why* a verdict was WA. This makes the platform feel useless on contest day.

### bug-17 — `/contests/{slug}/leaderboard` returns 200 with `contestStatus:"upcoming"` and `[]`

- Repro: `GET /api/contests/weekly-contest-1/leaderboard`.
- Expected: 425 / 412 *Too Early* or a 200 with explicit `available: false` and a UI gate.
- Actual: 200 `{"contestStatus":"upcoming","leaderboard":[]}`. UI consumers without contestStatus parsing will render an empty leaderboard with no explanation.

### bug-18 — `/contests/{slug}/join` accepts join on **upcoming** contests with no time gate

- Repro: contest start time is 2026-05-25, current time 2026-05-19. `POST /api/contests/weekly-contest-1/join` returns 201 with `entry`.
- Expected: HTTP 425 (Too Early) until contest opens — or join is allowed but participation is gated server-side.
- Why P1: not necessarily a bug — but this should be a deliberate policy decision, documented. Right now it isn't. The contest list page may show "Join" as a CTA outside contest hours.

### bug-19 — `429` on registration uses generic `"Too many registration attempts"` even for first-call validation errors

- After hitting the regex-failure path (no username supplied), subsequent valid retries still 429. The 429 fires *before* schema validation, which means a typo costs you a cooldown. Fix: rate-limit only on success, or count only requests that pass schema.

### bug-20 — `X-Forwarded-For` is honored for IP-bucket rate-limit (verified via spoofed header → distinct bucket)

- Repro: `POST /api/auth/register -H 'X-Forwarded-For: 198.51.100.7'` succeeded with 201 right after a 429 from the real IP.
- Why P1: if Caddy / NGINX is *not* in front of Next.js, an attacker can rotate the header to bypass IP-based rate limits. Confirm trust-proxy semantics. If the rate limit is meant to apply per real IP, set `app.set('trust proxy', 1)` or read from a hop-counted forwarded chain.


---

## P2 — nits / polish

### bug-21 — `/api/discussions` 400 message reads like a system prompt

- `{"error":"problemId is required"}` is fine, but the surrounding endpoints use sentence-cased messages and this is verbatim variable name. Match the rest of the codebase ("Problem ID is required").

### bug-22 — `/api/users/{username}/stats` reports `solved: 0` after a `wrong_answer`

- After two submissions ending in WA, `stats.totalSubmissions: 2, accepted: 0, solved: 0` is correct, but the dashboard component reads `solved` as the headline number — needs an empty-state copy.

### bug-23 — `/api/auth/sessions` only ever returns the current session

- Repro: `GET /api/auth/sessions` → `[{"current":true}]` even after multiple logins on different IPs. Either sessions aren't persisted (bug-15 territory) or the endpoint silently filters to "this token only".

### bug-24 — Submission listing endpoint has no `?status=` filter

- `GET /api/submissions?problemId=` works, but `?status=accepted` is silently ignored. Consumers building a "Show only accepted" toggle will need a fresh API call.

### bug-25 — `/api/openapi` returns YAML with `Cache-Control: max-age=300` from a private user fetch

- Cacheable for 5 min with no `Vary`. Acceptable but flag if the OpenAPI ever depends on auth.

### bug-26 — `OPTIONS /api/problems` returns 204 with no `Access-Control-Allow-*` headers

- This is fine for same-origin Next.js, but if a third-party SPA wants to use the API, they'll fail CORS. Either document "first-party only" or add an explicit allow-list.

### bug-27 — `/leaderboard?limit=5` honors limit but `/api/problems?limit=999` clamps to 50 silently

- Inconsistent clamp behavior across endpoints. Either return 400 on over-limit or include `limit` in the response so callers know they were clamped.

### bug-28 — `Reverse String` testcase format is `["h","e","l","l","o"]` JSON literal in `input`

- The expected output `["o","l","l","e","h"]` is also a JSON literal. If the judge expects `["h","e","l","l","o"]\n` parsed via `json.loads(stdin)` the user must know this from an external doc — there is no per-problem hint about the I/O format on the problem page.

### bug-29 — `submissionCount` on problems-list reflects all-time, not per-user

- Confusing on the user dashboard where the same component is reused: a user with 0 solves still sees "1k submissions" badge on Two Sum.

### bug-30 — `next-size-adjust` meta is empty

- Cosmetic — the head injection on `/` includes `<meta name="next-size-adjust" content="" />`. Either remove or populate.

### bug-31 — `home` HTML title says "LeetRank — Practice coding, level up" but the navbar says "LeetRank"

- Tone mismatch between meta and visible brand. Pick one.


---

## Won't fix / by design

- `/api/auth/profile` GET returning 405 — explicitly documented, `/api/auth/me` is the read endpoint.
- Anonymous `/api/submissions`, `/api/run-code`, `/api/auth/me` all 401 with `{"error":"Unauthorized"}` — generic but consistent. The submission-auth UX team is shipping a proper sign-in modal so client-side error mapping covers the bad UX side.
- `Tampered JWT` cookie → 401, no information leak. As-designed.
- Negative pagination (`?page=-1&limit=999`) treated as defaults — defensible.
- Auth legacy `POST /login` returns 501 — the `auth-go` service is meant to replace it (currently DOWN). Tracked in API smoke report.
- Anonymous `/admin/users` returns 401 (not 403) — fine; admins-as-anons distinction is not surfaced.

---

## Recommended fix teams

| Team   | Owns                                        | Bugs covered             |
| ------ | ------------------------------------------- | ------------------------ |
| TEAM-J | Judge harness, testcase format, verdict shape | bug-1, bug-16, bug-28    |
| TEAM-A | Auth flows, rate limit policy, session lifecycle | bug-2, bug-8, bug-19, bug-20, bug-23 |
| TEAM-S | Status / discussions surface, ISR cache    | bug-3, bug-6, bug-12, bug-13 |
| TEAM-C | API contract polish (error msgs, schemas, methods) | bug-4, bug-5, bug-7, bug-10, bug-21, bug-26, bug-27 |
| TEAM-P | Profile / settings hardening (avatar URL, validation) | bug-9, bug-11 |
| TEAM-L | Contests + leaderboard contract            | bug-14, bug-15, bug-17, bug-18 |
| TEAM-N | Nits / copy / metadata                     | bug-22, bug-24, bug-25, bug-29, bug-30, bug-31 |

---

## Notes for the leader

- Could not fully exercise: `auth-go` / `submissions-go` / `problems-go` Go services — they didn't boot (build failures from earlier QA pass remain unfixed). Their HTTP contracts should be tested once the builds are green.
- Coverage gap: WebSocket / SSE — only verified that `/api/submissions/{id}/stream` returns `text/event-stream` headers and a single `event: status` chunk on a finished submission. Not exercised on a live `queued → running → done` transition because every submission landed `wrong_answer` quickly (bug-1).
- Could not test: real password reset flow (no `/api/auth/reset-password` endpoint surfaced in OpenAPI; if it exists, it's behind `/api/auth/email/...` somewhere and not in the route tree).
- Could not test: 2FA, OAuth — no provider configured locally.
- Could not test: profile-page render UI (settings page lives at `/dashboard/settings`, not `/profile`; the prerender cache flag suggests it might serve stale data after edits — recommend sequential PATCH → fetch test once bug-12 is fixed).
- The Go judge container is marked **unhealthy** in `docker compose ps` despite returning 200 to `/health`. Likely a HEALTHCHECK definition that diverges from the actual readiness endpoint. Worth a 5-min fix.
- Marketing copy on the home page promises "10K+ problems" but `/api/stats` reports `problems: 10`. Either dial back the copy or stop calling the home stats "live".
- The team currently fixing submission-auth UX (in `src/app/problems/[slug]/page.tsx`) should be made aware of bug-4, bug-5, bug-16 — they likely encountered some of the same surface.

---

## How to reproduce

```sh
# Boot the stack
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Sanity probe
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:13000/api/health  # 200

# Run the existing smoke test (60 cases)
node tests/api/smoke.mjs

# Each P0/P1 above has a self-contained curl line — no fixture beyond the
# seeded database is required.
```

## Test artefacts

- Smoke runner output: `docs/testing/smoke-report.json` (60/60 pass, no regression in HTTP-layer probes — all bugs above are *behavioural*, not status-code regressions).
- Earlier API report: `docs/testing/2026-05-API-TEST-REPORT.md`.
- This report: `docs/testing/2026-05-FULL-QA-REPORT.md`.

