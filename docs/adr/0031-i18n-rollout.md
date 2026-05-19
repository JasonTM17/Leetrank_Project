# 0031 — Internationalisation rollout (Phase 1 cookie locale, Phase 2 deferred)

- **Status**: Accepted
- **Date**: 2026-05-19

## Context

LeetRank serves Vietnamese and English-speaking developers. Until 2026-05 the
UI was English-only with hardcoded strings, while documentation lived in a
single English README/CONTRIBUTING/SECURITY set. The user reported the gap and
asked for full multilingual support including documentation.

The web tier is Next.js 16 App Router with a JWT middleware (`src/middleware.ts`)
that enforces `/dashboard` and `/admin` access. There is no routing
restructure; every path is at the root. The JWKS cutover (ADR 0030) is in
flight on the same middleware module.

We had to choose between two i18n shapes:

1. **Cookie-based locale, single route tree** — pick the locale at request
   time from a cookie (`NEXT_LOCALE`) with `Accept-Language` fallback. Render
   server components against the resolved locale via
   `next-intl/server::getRequestConfig`. URLs are unchanged
   (`/problems`, not `/en/problems`).

2. **Path-segmented locale, `[locale]` route group** — every page lives under
   `src/app/[locale]/...` and the URL carries the locale
   (`/vi/problems`). `next-intl/middleware` rewrites and the JWT
   middleware would need to be aware of the locale prefix.

## Decision

Ship Phase 1 = option 1 (cookie-based) now, defer Phase 2 = option 2 to a
later session.

`next-intl@4` is the i18n library. Two locales: `en` (default) and `vi`.

## Phase 1 — what is shipped

- `next-intl/plugin` wired into `next.config.ts`.
- Request config in `src/i18n/request.ts` reads `NEXT_LOCALE` cookie, falls
  back to `Accept-Language` (Vietnamese only — everything else stays English).
- Server action `src/i18n/actions.ts` writes the cookie and revalidates the
  layout.
- Message catalogs at `messages/en.json` and `messages/vi.json` cover
  navigation, home hero, login, problems, contests, leaderboard, dashboard,
  errors, footer.
- Locale switcher component
  (`src/components/layout/locale-switcher.tsx`) integrated into the navbar
  desktop and mobile sheets.
- `src/app/layout.tsx` wraps children in `NextIntlClientProvider`, sets
  `<html lang>` from the resolved locale, generates locale-aware
  `<title>` / `<description>` metadata.
- Translated surfaces: navbar (links, logout, user menu), footer, home page
  (hero, features grid, languages section, final CTA), login page form +
  hero pane.
- Test setup mocks `next-intl` so `useTranslations()` returns key names
  verbatim; component tests stay focused on shape rather than copy
  (`src/__tests__/setup.ts`, `src/__tests__/ui/footer.test.tsx`).
- Vietnamese documentation: `README.vi.md`, `CONTRIBUTING.vi.md`,
  `SECURITY.vi.md`. Each canonical English doc gets a language picker line at
  the top.
- ADRs and OpenAPI specs stay English-only — this is documented in
  `CONTRIBUTING.vi.md` so future contributors don't translate them.

## Why Phase 1 first

- **Risk surface is narrow.** No middleware restructure, no JWT path-prefix
  awareness, no impact on the JWKS cutover currently landing in middleware.
- **Tests stay green.** Existing tests assert against rendered HTML. The
  next-intl mock returns keys verbatim, so the test suite continues to
  exercise structure without coupling to copy.
- **No URL churn.** Existing bookmarks, search engine results, and OpenAPI
  examples all keep working. Marketing/SEO can opt in later.
- **Translations land immediately.** Users get the language switcher and
  Vietnamese strings on the highest-traffic surfaces (navbar, home, auth)
  the day this ships.

## Phase 2 — deferred

Phase 2 will move every page to `src/app/[locale]/...` and adopt
`next-intl/middleware` for locale negotiation in URLs. Open questions before
we start:

1. **JWT middleware composition.** `next-intl/middleware` and our JWT guard
   both want to run on protected routes. We need to decide whether to chain
   them (next-intl rewrite -> JWT verify) or fold the locale parsing into
   the existing middleware.
2. **JWKS cutover ordering.** The middleware currently absorbs the JWKS
   migration (ADR 0030). Rebuilding it for i18n while the legacy HS256
   fallback is still active doubles the blast radius.
3. **Sitemap and SEO.** `/en/...` and `/vi/...` need `hreflang` annotations,
   sitemap entries per locale, and a redirect strategy for the existing
   bare paths.
4. **Static analytics IDs.** The status page, analytics events, and webhook
   signatures contain raw paths today. Adding a locale prefix changes that
   surface; consumers need to be audited.

These are not blockers, just unsuited to a single autonomous session that
also has to translate strings and write VI docs.

## Consequences

Positive:

- Vietnamese users see fully localised navbar, hero, auth, and footer on day
  one, with their preference persisted across sessions.
- README/CONTRIBUTING/SECURITY have parallel Vietnamese versions linked from
  the top of each English canonical doc.
- The translation pipeline (catalog -> component) is exercised end-to-end,
  so adding more strings is a one-namespace edit, not an architecture change.
- The build, test, and typecheck targets all stay green; CI gating remains
  unchanged.

Negative:

- URLs do not encode the locale, so search engines and link previews can't
  pick a localised page directly. SEO will improve in Phase 2.
- A user on shared hardware can't easily share a Vietnamese URL with an
  English-speaking colleague (and vice versa) — they'd both see whatever
  cookie they have.
- API error messages remain in English. Translation happens in the UI layer;
  the wire format is intentionally stable.

Neutral:

- Documentation discipline: ADRs and OpenAPI stay English-only. Adding a
  Vietnamese ADR creates a fork for technical consensus that we don't want.

## Alternatives considered

- **next-i18next.** Older, optimised for Pages Router. Server component
  ergonomics are worse and the maintainer recommends `next-intl` for App
  Router projects since v13.
- **lingui.** More feature-rich but heavier and not first-class for App
  Router server components.
- **Roll our own.** Trivial to start, but eventually we'd reimplement
  pluralisation, ICU, and lazy message loading. Not worth the maintenance.

## References

- `next-intl` docs: <https://next-intl.dev/docs/getting-started/app-router>
- ADR 0030 (JWKS cutover) — context for not touching middleware mid-flight.
- ADR 0011 — split-backend-frontend rationale (translations stay in the web
  tier; backend speaks API errors in English by contract).
