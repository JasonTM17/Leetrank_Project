# Day 1 Onboarding

Everything you need to go from zero to a running LeetRank stack on your local machine.

---

## Required tools

| Tool                    | Minimum version          | Install                                                      |
| ----------------------- | ------------------------ | ------------------------------------------------------------ |
| Node.js                 | 20                       | https://nodejs.org                                           |
| Go                      | 1.22                     | https://go.dev/dl                                            |
| Docker + Docker Compose | Engine 24, Compose v2.20 | https://docs.docker.com/get-docker                           |
| pnpm                    | 10                       | `corepack enable && corepack prepare pnpm@latest --activate` |

Verify before continuing:

```bash
node --version    # v20+
go version        # go1.22+
docker --version  # 24+
pnpm --version    # 10+
```

---

## Step-by-step setup

### 1. Clone the repository

```bash
git clone https://github.com/JasonTM17/Leetrank_Project.git
cd Leetrank_Project
```

### 2. Copy the environment file

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

- `DATABASE_URL` — PostgreSQL connection string (the compose stack provides `postgresql://postgres:postgres@localhost:5432/leetrank` by default)
- `JWT_SECRET` — any string of 16+ characters for local dev

### 3. Install dependencies

```bash
pnpm install --frozen-lockfile
```

This installs workspace dependencies for the root web app, `apps/api`, and all packages in one pass.

### 4. Push the database schema

```bash
npx prisma db push
```

This applies `prisma/schema.prisma` to the database without creating a migration file. Use this for local dev; use `prisma migrate deploy` in CI/production.

### 5. Seed 1000 problems and 1000 contests

```bash
pnpm run seed:1k
```

This runs `prisma/seed-bulk.ts` with a deterministic RNG — the same command always produces the same dataset. It also seeds the hand-curated problem set from `prisma/seed.ts` if it has not been run yet.

### 6. Start the full local stack

```bash
docker compose up postgres redis app api identity judge
```

This starts:

| Service    | URL                   | Role                                |
| ---------- | --------------------- | ----------------------------------- |
| `app`      | http://localhost:3000 | Next.js frontend                    |
| `api`      | http://localhost:4000 | Hono read-only API                  |
| `identity` | http://localhost:4011 | Identity service (services/auth-go) |
| `judge`    | http://localhost:9090 | Go code execution                   |
| `postgres` | localhost:5432        | Database                            |
| `redis`    | localhost:6379        | Cache                               |

For hot-reload during development:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up app api postgres redis
```

### 7. Open the app

Navigate to http://localhost:3000. You should see the LeetRank landing page.

### 8. Log in with a seed account

The seed creates these accounts:

| Email                  | Password    | Role  |
| ---------------------- | ----------- | ----- |
| `admin@leetrank.local` | `Admin123!` | Admin |
| `demo@leetrank.local`  | `Demo123!`  | User  |

Log in as `user1` to explore the platform as a regular user. Log in as `admin` to access the admin panel at `/admin`.

### 9. Verify the judge works

1. Navigate to any problem (e.g. http://localhost:3000/problems).
2. Open a problem and select Python as the language.
3. Write a minimal solution:
   ```python
   print(input())
   ```
4. Click **Run Code**. You should see test results within a few seconds.
5. Click **Submit**. A green "Accepted" badge confirms the judge pipeline is working end-to-end.

---

## After Day 1

### Rules and conventions

Project rules live in [`AGENTS.md`](../AGENTS.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

### ADR catalog

Architecture decisions are recorded in `docs/adr/`. Start with:

- [0011 — FE/BE split](adr/0011-split-backend-frontend.md) — why `apps/api` exists
- [0013 — Service-to-service auth](adr/0013-service-to-service-auth.md) — how JWTs flow between services
- [0003 — Go judge](adr/0003-go-for-judge-service.md) — why the judge is in Go

Use `docs/adr/template.md` when recording a new decision.

### Runbooks

Operational procedures live in `docs/runbooks/`:

- [docker.md](runbooks/docker.md) — compose commands, rebuilds, teardown, observability overlay

### How to add a new API route

1. Create a handler file in `apps/api/src/routes/`.
2. Add the Zod response schema to `packages/api-contracts/src/schemas.ts` and re-export it.
3. Register the route in `apps/api/src/server.ts`.
4. Write a Vitest test in `apps/api/src/__tests__/`.
5. Update `docs/openapi.yaml` with the new path.

### How to add a new judge language

1. Add an entry to `judge-service/languages.json` (the single source of truth for the language registry).
2. If the language needs a custom runner script, add it under `judge-service/runners/`.
3. Run `go test -race ./...` in `judge-service/` to verify.
4. Update the supported languages table in `judge-service/README.md`.

### How to add a new shadcn component

```bash
npx shadcn@latest add <component-name>
```

Components land in `src/components/ui/`. Import them from `@/components/ui/<name>`.

### How to record a new ADR

1. Copy `docs/adr/template.md` to `docs/adr/NNNN-short-title.md` where `NNNN` is the next sequential number.
2. Fill in all sections. Set status to `Proposed` until the decision is accepted.
3. Commit the ADR in the same PR as the code change it documents.

---

**Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
