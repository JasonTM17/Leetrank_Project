# 0002. Use PostgreSQL over SQLite

Date: 2026-05-17
Status: Accepted

## Context

The development environment currently uses SQLite (`provider = "sqlite"` in `prisma/schema.prisma`, `DATABASE_URL=file:/app/data/dev.db` in `docker-compose.yml`). SQLite is convenient for local development — zero setup, single file, no daemon — but it has hard limits that matter for LeetRank:

- **No logical replication.** We cannot stream changes to read replicas or event consumers without third-party hacks.
- **No JSONB.** Storing structured data (e.g. per-language starter code, test case metadata) requires either serialised strings or extra tables. PostgreSQL's `jsonb` type gives indexed, queryable JSON natively.
- **Concurrent writers are serialised.** SQLite uses a single write lock; under load (many simultaneous submissions) this becomes a bottleneck. PostgreSQL uses MVCC.
- **Prisma's SQLite adapter lacks some features** (e.g. `@@fulltext` indexes, `Json` field type) that are available on PostgreSQL.

The production compose file (`docker-compose.prod.yml`) already externalises `DATABASE_URL` via an environment variable, making the switch transparent to application code.

## Decision

Use **PostgreSQL 16** as the database engine in all environments. The `docker-compose.yml` development stack will add a `postgres` service. The Prisma schema datasource will be changed to `provider = "postgresql"`.

## Consequences

- **Easier:** Full Prisma feature set available; JSONB columns for `starterCode` and similar fields; read-replica support when needed.
- **Harder:** Existing dev clones using SQLite must run `prisma migrate dev` (or `prisma db push --force-reset`) after pulling the schema change. A one-time migration step is required.
- **Risk:** Developers on low-memory machines now need Docker running a Postgres container. Mitigated by keeping the compose service lightweight (no persistent volume needed for dev).

## Alternatives considered

- **Keep SQLite for dev, Postgres for prod** — Prisma supports this but schema divergence causes subtle bugs (e.g. case-sensitivity differences, missing index types). Rejected in favour of parity.
- **PlanetScale (MySQL-compatible)** — no foreign key enforcement by default; incompatible with Prisma's cascade deletes as modelled in `schema.prisma`.
- **Turso (libSQL)** — interesting edge-native option but Prisma support was experimental at decision time.
