# Project Rules & Best Practices

> **Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)

Lessons learned from building LeetRank. Apply these to future full-stack Next.js projects.

---

## 0. Author & Workflow

- **Author:** Nguyễn Sơn (jasonbmt06@gmail.com)
- **GitHub:** JasonTM17
- **Git operations:** Luôn dùng MCP GitHub để push, tạo PR, quản lý issues — không dùng git CLI cho remote operations.
- **Contributor:** Chỉ JasonTM17 — không được để AI/bot xuất hiện trong contributor list.
- **Commit style:** Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
- **Documentation disclaimer:** Mọi README/docs phải ghi rõ: "Đây là dự án học tập của Nguyễn Sơn (jasonbmt06@gmail.com). Mọi ý kiến đóng góp và phản hồi xin gửi qua email hoặc GitHub Issues."

---

## 1. Project Setup

- **TypeScript strict mode** — enable `"strict": true` in `tsconfig.json` from day one. Fixing type errors later is painful.
- **App Router only** — use Next.js App Router (`app/`). Pages Router is legacy; don't mix them.
- **Prisma early** — define your schema before writing any business logic. Changing the schema mid-project causes cascading refactors.
- **`.env.example` immediately** — commit a `.env.example` with every key (no values) the moment you add a new env var. Never let it drift.
- **`.gitignore` on init** — include `.env*`, `*.db`, `*.sqlite`, `node_modules/`, `.next/`, `dist/`, and any judge temp directories before the first commit.
- **SQLite for dev, PostgreSQL for prod** — SQLite requires zero infrastructure locally. Use `DATABASE_URL` in `.env` to switch; Prisma handles both.

---

## 2. Architecture

- **Separate concerns** — keep code in `components/`, `lib/`, `services/`, `hooks/`, and `types/`. Route handlers should be thin wrappers.
- **Business logic in `services/`** — route handlers validate input and call a service function. Services own the logic. This makes testing and reuse straightforward.
- **Database access through a singleton** — create `lib/db.ts` that exports a single Prisma client instance. Import only from there; never instantiate `PrismaClient` elsewhere.
- **Middleware for auth** — use Next.js `middleware.ts` to protect routes at the edge. Don't repeat auth checks inside every route handler.
- **API routes return proper HTTP codes** — `200` success, `201` created, `400` bad input, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `422` validation error, `500` server error. Be precise.
- **Validate input server-side** — use Zod (or similar) to parse and validate every request body and query param before touching the database.

---

## 3. UI/UX

- **Three states for every page** — loading skeleton, error boundary, and empty state. Ship all three before calling a feature done.
- **Design tokens via CSS variables** — define colors, spacing, and radii in `globals.css` as `--token-name`. Never hardcode hex values in components.
- **Mobile-first** — write base styles for small screens, then use `md:` and `lg:` breakpoints to scale up.
- **Dark mode from the start** — adding dark mode to an existing design is expensive. Use `class` strategy with Tailwind and wire it up on day one.
- **shadcn/ui patterns** — prefer composable, accessible primitives over building from scratch. Copy components into `components/ui/` so you own the code.
- **Subtle animations** — transitions should aid comprehension (loading states, focus rings, hover feedback), not distract. Keep durations under 300ms.
- **Dynamic imports for heavy components** — Monaco Editor, chart libraries, and similar packages must use `next/dynamic` with `ssr: false` to avoid bloating the initial bundle.

---

## 4. Security

- **No hardcoded secrets** — all secrets go in `.env`. If a secret appears in source code, rotate it immediately.
- **bcrypt with cost ≥ 10** — use `bcryptjs` or `bcrypt`. Cost 10 is the minimum; cost 12 is reasonable for auth endpoints.
- **httpOnly cookies for JWT** — never store tokens in `localStorage`. Set `httpOnly`, `secure`, and `sameSite: 'lax'` on auth cookies.
- **Server-side input validation** — client-side validation is UX only. Always re-validate on the server with a schema library.
- **Sanitize output** — escape user-generated content before rendering. React does this by default; avoid `dangerouslySetInnerHTML` unless absolutely necessary.
- **Rate limit API endpoints** — apply rate limiting to auth routes (login, register, password reset) and any compute-heavy endpoints (code submission).
- **Block dangerous patterns in the judge** — per language, maintain a blocklist of dangerous imports and syscalls (`os`, `subprocess`, `exec`, `eval`, file system access outside sandbox, network calls).

---

## 5. Code Quality

- **Typecheck before every commit** — run `tsc --noEmit` in CI and locally. A passing build with type errors is not a passing build.
- **Components under 200 lines** — if a component grows beyond 200 lines, split it. Large components are hard to test and review.
- **Extract logic into hooks** — any stateful logic used in more than one place belongs in a custom hook in `hooks/`.
- **No `any`** — use `unknown` and narrow it, or define a proper type. `any` defeats the purpose of TypeScript.
- **Consistent naming conventions**:
  - Functions and variables: `camelCase`
  - Components and types/interfaces: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - Files: `kebab-case` for utilities, `PascalCase` for components
- **Collocate related files** — keep a component's styles, tests, and sub-components near the component, not in a distant `__tests__/` folder.

---

## 6. Git & Repo

- **Conventional commits** — use `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:` prefixes. Atomic commits: one logical change per commit.
- **Never commit secrets or binaries** — `.env`, `*.db`, `*.sqlite`, `node_modules/`, and build artifacts must be in `.gitignore` before the first commit.
- **Standard repo files** — include `LICENSE`, `README.md`, and `CONTRIBUTING.md`. A project without these is incomplete.
- **CI/CD from the start** — set up a GitHub Actions workflow that runs `tsc --noEmit`, `eslint`, and `next build` on every push. Catching breakage early is cheap; catching it in production is not.
- **Docker for reproducibility** — provide a `Dockerfile` and `docker-compose.yml` so any contributor can run the full stack with one command.
- **Branch protection on `main`** — require passing CI checks before merging. Direct pushes to `main` should be blocked.

---

## 7. Judge Service

- **Sandbox every execution** — run submitted code in an isolated process with no network access and a restricted filesystem view.
- **Hard time and memory limits** — enforce both at the OS level (e.g., `ulimit`, cgroup limits, or Docker resource constraints), not just in application code.
- **Per-language blocklists** — maintain explicit lists of forbidden imports and operations for each supported language. Fail closed: if a pattern is unknown, reject it.
- **Separate process per submission** — never reuse a process across submissions. A crashed or compromised process must not affect others.
- **Clean up temp files** — delete all temporary source files, binaries, and output files after execution, whether it succeeds or fails.
- **Runner scripts per language** — implement a thin shell or Python runner for each language that handles compilation, execution, and output capture uniformly.
- **Structured output** — the judge should return a consistent JSON shape: `{ status, stdout, stderr, exitCode, timeMs, memoryKb }`.

---

## 8. Database

- **Migrations for every schema change** — never edit the database directly in any environment. All changes go through `prisma migrate dev` (dev) and `prisma migrate deploy` (prod).
- **Seed data for development** — maintain a `prisma/seed.ts` that populates realistic test data. Onboarding a new developer should require only `prisma migrate dev && prisma db seed`.
- **Index frequently queried columns** — add `@@index` in the Prisma schema for any column used in `WHERE`, `ORDER BY`, or `JOIN` conditions in hot paths.
- **Cascading deletes** — define `onDelete: Cascade` on relations where child records have no meaning without the parent (e.g., submissions belong to a user).
- **Normalized but pragmatic** — normalize to avoid update anomalies, but don't over-normalize. Denormalize intentionally when query performance demands it, and document why.
- **Never expose raw database errors** — catch Prisma errors and return sanitized messages to the client. Log the full error server-side.

---

## 9. Testing

- **TypeScript compilation is the first test** — if `tsc --noEmit` fails, nothing else matters.
- **Build must pass before deploy** — `next build` catches missing imports, invalid JSX, and other issues that type checking alone misses. Make it a required CI step.
- **Test API endpoints with status codes** — at minimum, write integration tests that hit each route and assert the correct HTTP status for both happy and error paths.
- **Test auth flows end-to-end** — register, login, access protected resource, logout, attempt access again. Automate this sequence.
- **Test the judge with known inputs** — for each supported language, maintain a set of test programs with known outputs. Run them as part of CI to catch regressions in the sandbox.

---

## 10. Performance

- **Dynamic imports for heavy components** — Monaco Editor and similar packages must be loaded lazily. Use `next/dynamic` with a loading fallback.
- **Paginate all lists** — never return unbounded query results. Default page size of 20–50; expose `page` and `limit` params.
- **Cache database queries** — use React's `cache()` or a simple in-memory cache for read-heavy, rarely-changing data (e.g., problem lists, language configs).
- **Proper indexes** — review `EXPLAIN` output for slow queries. An unindexed foreign key on a large table will cause visible latency.
- **Avoid N+1 queries** — use Prisma's `include` to fetch related data in a single query rather than looping and querying inside a loop.
- **Measure before optimizing** — use Next.js bundle analyzer and browser DevTools to identify actual bottlenecks. Don't optimize speculatively.

---

## 11. Repo Structure

- **Separate frontend and backend** — every repo must have clear separation: `frontend/` and `backend/` (or `judge-service/`, `api/`) directories. Config files at root.
- **Microservices = separate containers** — each service gets its own Dockerfile, docker-compose.yml orchestrates all services together.
- **Monorepo with clear boundaries** — if using monorepo, each service is independently buildable and deployable.
- **Shared types** — create a `shared/` or `types/` package for interfaces used by both frontend and backend.

---

## 12. UI/UX Tooling

- **MCP shadcn** — always use shadcn MCP to search and reference component patterns. Don't reinvent UI primitives.
- **MCP Stitch + Gemini 3.1 Pro** — use Stitch for design system creation, screen generation, and design iteration. Leverage Gemini for high-quality UI generation.
- **Plugin UI/UX Pro Max** — use for color palettes, font pairings, layout patterns, and style guidance (glassmorphism, bento grid, etc.).
- **Playwright MCP** — use for visual testing and UI verification after changes.
- **Design before code** — always design/prototype screens before implementing. Use Stitch to generate and iterate on designs.

---

## 13. Documentation & Media

- **Screenshots in every repo** — create a `docs/screenshots/` folder with annotated screenshots of every major feature.
- **GIFs for interactions** — record GIFs showing key user flows (login, solving a problem, submitting code, etc.).
- **Caption every image** — in README, every screenshot/GIF must have a descriptive caption explaining what it shows.
- **Keep media updated** — when UI changes, update screenshots. Stale screenshots are worse than none.
- **README media section** — dedicate a section in README with a visual tour of the application.

---

## 14. Containerization & Orchestration

- **Docker bắt buộc** — mọi dự án đều phải có `Dockerfile` và `docker-compose.yml`. Không có Docker = không chuyên nghiệp. Đây là yêu cầu tối thiểu.
- **Multi-stage builds** — sử dụng multi-stage Dockerfile để giảm image size. Stage 1: build, Stage 2: runtime (alpine/distroless).
- **docker-compose cho dev** — mọi service (app, database, cache, judge) phải chạy được bằng một lệnh `docker-compose up`.
- **Health checks** — mọi container phải có `HEALTHCHECK` instruction hoặc health check endpoint.
- **Environment separation** — tách `docker-compose.yml` (dev) và `docker-compose.prod.yml` (production) với config phù hợp.
- **Kubernetes cho yêu cầu cao** — khi cần scale, HA, hoặc production-grade deployment, sử dụng Kubernetes (k8s) với Helm charts hoặc Kustomize.
- **CI/CD pipeline** — tích hợp Docker build vào CI. Push images lên registry (GHCR, Docker Hub, ECR) tự động.
- **Công cụ nâng cao khi cần** — Terraform/Pulumi cho IaC, Istio/Linkerd cho service mesh, Prometheus/Grafana cho monitoring, ArgoCD cho GitOps. Chỉ dùng khi project scale đòi hỏi.

---

## 15. Automation & AI Tooling

- **Chatbot integration** — use n8n for workflow automation and chatbot features when needed.
- **Leverage all available MCPs** — before starting any task, check available MCP servers and plugins. Use them to increase quality.
- **Context7 for docs** — always use Context7 MCP to fetch current library documentation instead of relying on training data.
- **Claude Team for parallel work** — use Claude Team to parallelize independent tasks (frontend, backend, data, testing).
- **Rules-driven development** — every project must reference and follow these rules. Update rules after each project with new learnings.
