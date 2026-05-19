-- Performance indexes for hot-path queries identified in critic team review.
-- See docs/adr/0028-performance-indexes-and-bundle.md.
--
-- 1) User.role — admin gates and role filters
-- 2) Discussion(problemId, upvotes DESC) — top-discussions for a problem
-- 3) ChatMessage(contestId, createdAt) — contest-scoped chat lookups
--
-- Hand-written because the dev DB (SQLite) and prod DB (Postgres) drift on
-- index syntax; this file targets Postgres. Run with `prisma migrate deploy`.

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");

CREATE INDEX IF NOT EXISTS "Discussion_problemId_upvotes_idx"
  ON "Discussion" ("problemId", "upvotes" DESC);

CREATE INDEX IF NOT EXISTS "ChatMessage_contestId_createdAt_idx"
  ON "ChatMessage" ("contestId", "createdAt");
