# 32. Multi-session listing deferred until Session model lands

Date: 2026-05-19

## Status

Accepted

## Context

`/api/auth/sessions` (`src/app/api/auth/sessions/route.ts`) is documented to return all active sessions for the authenticated user. QA Bug #23 surfaced that the endpoint actually returns a single-entry list — the current request's own session, derived from the JWT cookie. We have no `Session` model in `prisma/schema.prisma` (verified at the time of writing: only `User`, `Tag`, `Problem`, `ProblemTag`, `TestCase`, `Submission`, `Contest`, `ContestProblem`, `ContestEntry`, `Discussion`, etc.) so there's nowhere to source additional sessions from.

We chose JWT-with-jose as our session token (ADR-0004) and kept sessions stateless. Listing "all sessions" requires server-side state — token IDs persisted with issued-at, IP, UA — which is a non-trivial schema and write-path change. It also intersects with ADR-0017 (auth-go rewrite) and ADR-0030 (web-tier JWT cutover) — the multi-session table should live in the identity service, not the Next web tier.

Doing it ad-hoc in the web tier now would create migration debt when identity takes ownership.

## Decision

Defer multi-session listing. Until the identity service grows a session table:

- `/api/auth/sessions` continues to return the current session as a single-entry list.
- The route documents this contract in a comment at the top of the file.
- This ADR records the decision so QA / reviewers know it's intentional, not a regression.

When the identity service ships persistent sessions, the route becomes a thin proxy that forwards `Authorization` to `identity:4011/v1/sessions` and returns the list verbatim. No web-tier schema changes are needed.

## Consequences

**Positive:**

- Avoids a throwaway `web_session` table in the Postgres owned by the web tier.
- Keeps multi-session as a single-source-of-truth concern in identity, consistent with ADR-0030.
- Contract surface is unchanged — a future implementation just returns a longer array.

**Negative:**

- Users can't see / revoke other devices today. Mitigation: change-password rotates the per-account login bucket (Bug #2 fix) and we still expire the cookie at 15 min, so blast-radius is bounded.

**Neutral:**

- Tests pin the single-session contract; they'll need an update when the array grows. That's expected churn for a contract change.

## Alternatives considered

| Alternative                                     | Why rejected                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Add a `Session` model to web Prisma now         | Crosses identity-service boundary; creates migration debt for ADR-0030 cutover.                                     |
| Best-effort scan of issued-but-not-revoked JWTs | Stateless JWTs by design have no server-side list; impossible without a token table.                                |
| Return empty array                              | Breaks the existing API contract (`sessions[0].current === true`) and tests; hides the current session pointlessly. |
