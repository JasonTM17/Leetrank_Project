# End-to-end tests

Playwright tests covering the critical UI flows per RULES §16.

## Run locally

```
pnpm install
pnpm playwright:install   # one-time browser download
pnpm test:e2e             # runs against `pnpm dev` started by playwright.config.ts
pnpm test:e2e:ui          # interactive UI mode
pnpm test:e2e:headed      # watch the browser
```

The default config boots Next.js via `webServer.command`. Override with
`E2E_BASE_URL=https://staging.leetrank.local pnpm test:e2e` to point at
an already-running deployment (CI uses this mode against compose).

## Viewports

Three projects per RULES §16:

| Project | Device | Viewport |
|---|---|---|
| `chromium-desktop` | Desktop Chrome | 1440×900 |
| `firefox-desktop` | Desktop Firefox | 1440×900 |
| `tablet` | iPad (gen 7) | 1080×810 |
| `mobile` | iPhone 13 | 390×844 |

Run a single project: `pnpm test:e2e --project=mobile`.

## Test layout

- `smoke.spec.ts` — every public page renders, 404 path returns 404, no console errors on the homepage, no horizontal scrollbar.
- `theme.spec.ts` — `next-themes` toggle persists across reload, three responsive routes fit each viewport.

Add new specs as `e2e/<feature>.spec.ts`. Reuse `getByRole` / `getByLabel` locators rather than CSS classes; markup changes shouldn't break a working contract.

## Updating snapshots

We don't ship visual-regression snapshots yet. When we do:

```
pnpm test:e2e --update-snapshots
```

## CI

`.github/workflows/e2e.yml` (manual trigger today) boots compose, waits
for `app:3000` to respond on `/healthz`, then runs the chromium-desktop
project. Reports upload as a 30-day artifact.

## Author

Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
