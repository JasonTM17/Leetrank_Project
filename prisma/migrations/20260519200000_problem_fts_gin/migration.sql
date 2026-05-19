-- Full-text search support for "Problem" (title + description).
-- Adds an immutable tsvector expression index using GIN for fast ranked
-- lookup with `ts_rank`. The `english` regconfig is used because problem
-- descriptions are English-only in this product.
--
-- Why a GIN index over the live expression instead of a stored generated
-- column? It avoids a schema migration in Prisma (which would force a
-- regen), keeps the model lean, and Postgres still uses the index for
-- queries that match the exact expression. See ADR 0028.

CREATE INDEX IF NOT EXISTS "Problem_search_gin_idx"
  ON "Problem"
  USING GIN (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  );
