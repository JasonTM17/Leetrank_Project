# Screenshots

Project screenshots used in the root README and documentation. All captures show populated, success-state UI with realistic seeded data.

## Naming convention

`<page-name>.png` — lowercase, hyphen-separated. Matches the `name` field in the capture scripts.

## Capture workflow

1. `pnpm docker:up` — start the full stack (DB, Redis, services).
2. `pnpm db:seed` — populate with realistic data (3-5 rows on lists, full markdown on detail pages).
3. `pnpm dev` — start the Next.js dev server in another terminal.
4. `node scripts/take-screenshots.mjs` — capture public pages (landing, problems, leaderboard, contests, discussions).
5. `node scripts/take-screenshots-auth.mjs` — capture logged-in pages (dashboard, admin panel, code editor). Uses the seeded admin test user.

Both scripts output to this directory (`docs/screenshots/`).

## Rules

- Never capture 404, empty list, loading skeleton, or auth redirect screens.
- Never capture login or register pages (they violate the "populated success state" rule).
- Always seed the database before capturing — empty UI looks broken.
- Wait for full hydration before capture (scripts use `waitForContent` checks).
- Re-run the full workflow after any major UI sweep.

## Current screenshots

| File | Source script | Description |
|------|--------------|-------------|
| `landing-page.png` | `take-screenshots.mjs` | Home page with hero, feature highlights, problem stats |
| `problems-list.png` | `take-screenshots.mjs` | Problem catalog with difficulty badges and acceptance rates |
| `leaderboard.png` | `take-screenshots.mjs` | Global ranking table with user stats |
| `contests.png` | `take-screenshots.mjs` | Contest listing with upcoming/active/past tabs |
| `discussions.png` | `take-screenshots.mjs` | Community discussions feed |
| `dashboard.png` | `take-screenshots-auth.mjs` | User dashboard with progress charts and recent activity |
| `admin-panel.png` | `take-screenshots-auth.mjs` | Admin overview with user/problem management |
| `code-editor.png` | `take-screenshots-auth.mjs` | Problem detail with Monaco editor and test results |

## Legacy assets

Previous captures (different naming/viewport) may still exist:
- `home.png`, `problems.png`, `problem-detail.png` — old 1920x1080 captures
- `mobile/` — responsive captures (375x667)
- `dark/` — dark mode variants
- `demo.gif`, `demo.webm` — end-to-end flow recordings

These are retained for reference but the canonical set is the table above.
