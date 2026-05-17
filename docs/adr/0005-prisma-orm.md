# 0005. Prisma ORM

Date: 2026-05-17
Status: Accepted

## Context

LeetRank needs a data access layer for a relational schema that includes Users, Problems, TestCases, Submissions, Contests, and join tables (`ProblemTag`, `ContestProblem`, `ContestEntry`). The schema is defined in `prisma/schema.prisma` and seeded via `prisma/seed.ts`, `prisma/seed-extra.ts`, and `prisma/seed-bigdata.ts`.

Requirements:
- Type-safe queries in TypeScript without hand-writing SQL
- Schema-as-code with migration support
- Works with both SQLite (current dev) and PostgreSQL (target, see ADR 0002)
- Good Next.js App Router integration (singleton client pattern)

## Decision

Use **Prisma** (v5, `@prisma/client` + `prisma` in `package.json`) as the ORM. The client is instantiated as a singleton in `src/lib/db.ts` using the `globalThis` pattern to avoid exhausting connection pools during Next.js hot-reload in development. Migrations are managed with `prisma db push` (dev) and will move to `prisma migrate deploy` in production.

## Consequences

- **Easier:** Auto-generated, fully typed client from the schema; `prisma studio` for visual data browsing; seed scripts in TypeScript; cascade deletes declared declaratively (`onDelete: Cascade`).
- **Harder:** The generated Prisma Client is large (~5 MB in `node_modules/.prisma`), which increases cold-start time in serverless environments. Schema changes require regenerating the client (`prisma generate`).
- **Risk:** Prisma migrations can be slow on large tables because they run DDL in a transaction. For the current scale this is acceptable.
- **Risk:** The `prisma db push` workflow used in dev does not produce a migration history. Switching to `prisma migrate dev` is recommended before the first production deployment.

## Alternatives considered

- **Drizzle ORM** — lighter client, SQL-first API. Was less mature and had fewer ecosystem integrations (e.g. Prisma Studio, seeding conventions) at the time this project was started. Worth revisiting.
- **Raw SQL with `pg` / `better-sqlite3`** — maximum control but significant boilerplate for type safety, migrations, and seeding. Rejected to keep velocity high.
- **Kysely** — type-safe query builder, no migration tooling. Would need a separate migration tool (e.g. `db-migrate`), adding complexity.
