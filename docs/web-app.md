# Web App (Next.js — `src/`)

The legacy Next.js application. Lives at the repo root under `src/` while the FE/BE split ([ADR 0011](adr/0011-split-backend-frontend.md)) is in progress. Once Phase 4 completes, this will move to `apps/web/`.

---

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing page — hero, stats, feature cards |
| `/problems` | `src/app/problems/page.tsx` | Paginated problem list with difficulty filter and search |
| `/problems/[slug]` | `src/app/problems/[slug]/page.tsx` | Problem detail + Monaco editor + test runner |
| `/contests` | `src/app/contests/page.tsx` | Contest list (upcoming, active, ended) |
| `/contests/[slug]` | `src/app/contests/[slug]/page.tsx` | Contest detail + problem set |
| `/leaderboard` | `src/app/leaderboard/page.tsx` | Global rankings table |
| `/dashboard` | `src/app/dashboard/page.tsx` | Personal stats, submission history, progress |
| `/login` | `src/app/login/page.tsx` | Email + password login form |
| `/register` | `src/app/register/page.tsx` | Registration form |
| `/admin` | `src/app/admin/page.tsx` | Admin dashboard (requires `role: admin`) |
| `/admin/problems` | `src/app/admin/problems/page.tsx` | Problem CRUD |
| `/admin/users` | `src/app/admin/users/page.tsx` | User management |
| `/admin/contests` | `src/app/admin/contests/page.tsx` | Contest management |

---

## API routes (being ported to `apps/api`)

Routes under `src/app/api/` are the canonical handlers until Phase 3 of ADR 0011 completes. As each vertical slice migrates, the Next.js route is replaced by a proxy rewrite to `apps/api`.

| Route | Status |
|-------|--------|
| `/api/auth/*` | Remaining in `apps/web` until Phase 3.1.5 |
| `/api/problems`, `/api/problems/[slug]` | Ported to `apps/api` (Phase 2) |
| `/api/problems/trending`, `/api/problems/random` | Ported to `apps/api` (Phase 2) |
| `/api/contests`, `/api/contests/[slug]` | Ported to `apps/api` (Phase 2) |
| `/api/leaderboard/top` | Ported to `apps/api` (Phase 2) |
| `/api/tags`, `/api/tags/[slug]` | Ported to `apps/api` (Phase 2) |
| `/api/stats` | Ported to `apps/api` (Phase 2) |
| `/api/run-code` | Remaining in `apps/web` |
| `/api/submissions` | Remaining in `apps/web` |
| `/api/admin/*` | Remaining in `apps/web` |
| `/api/chat` | Remaining in `apps/web` — proxies to n8n |

---

## Key components

| Component | Path | Description |
|-----------|------|-------------|
| `ProblemEditor` | `src/components/ProblemEditor.tsx` | Monaco editor wrapper with language selector and run/submit buttons |
| `ChatWidget` | `src/components/ChatWidget.tsx` | AI assistant chatbot — mounts on the problem detail page, sends messages to `/api/chat` |
| `Navbar` | `src/components/Navbar.tsx` | Top navigation with auth state, dark mode toggle |
| `ThemeProvider` | `src/components/ThemeProvider.tsx` | Wraps the app in `next-themes` for dark/light mode |
| `AdminGuard` | `src/lib/admin-guard.ts` | Server-side role check — redirects non-admin users away from `/admin/*` |

---

## Layout

```
src/
├── app/
│   ├── layout.tsx          # Root layout — ThemeProvider, Navbar, fonts
│   ├── page.tsx            # Landing page
│   ├── problems/
│   ├── contests/
│   ├── leaderboard/
│   ├── dashboard/
│   ├── login/
│   ├── register/
│   ├── admin/
│   └── api/                # Next.js route handlers (being ported out)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── ProblemEditor.tsx
│   ├── ChatWidget.tsx
│   ├── Navbar.tsx
│   └── ThemeProvider.tsx
├── lib/
│   ├── db.ts               # Prisma client singleton
│   ├── auth.ts             # JWT helpers (jose)
│   ├── rate-limit.ts       # In-memory rate limiter
│   ├── queue.ts            # Submission queue
│   ├── cache.ts            # Redis cache helpers
│   └── admin-guard.ts      # Role-based redirect
└── services/
    └── judge-client.ts     # HTTP client for the Go judge service
```

---

## Dark mode

Dark mode is implemented with [`next-themes`](https://github.com/pacocoursey/next-themes). The `ThemeProvider` wraps the root layout and sets `attribute="class"` so Tailwind's `dark:` variants activate on the `<html>` element. The toggle lives in `Navbar.tsx`. The selected theme is persisted in `localStorage` and respected on first paint via the `suppressHydrationWarning` attribute on `<html>`.

---

## Monaco editor

The Monaco editor (`@monaco-editor/react`) is loaded with a dynamic import to avoid SSR:

```ts
// src/components/ProblemEditor.tsx
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
```

See [ADR 0010](adr/0010-monaco-editor-dynamic-import.md) for the rationale.

---

## Chatbot

The AI assistant mounts on the problem detail page via `ChatWidget.tsx`. It sends `POST /api/chat` with the user message and conversation history. The Next.js route handler forwards the request to n8n at `N8N_CHATBOT_WEBHOOK_URL`. See [infra/n8n/README.md](../infra/n8n/README.md) for the workflow shape.

<!-- TODO: add docs/screenshots/web-app-*.png once screenshot tooling is set up -->

---

**Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
