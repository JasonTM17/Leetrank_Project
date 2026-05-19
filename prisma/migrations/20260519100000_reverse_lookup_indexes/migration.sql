-- Reverse-lookup indexes for join/foreign-key columns surfaced in critic
-- review. The composite primary keys on join tables only help when the
-- leading column is in the WHERE clause; queries that filter by the
-- secondary column (e.g. "all problems for a tag") fall back to a sequential
-- scan without these single-column indexes.
--
-- 1) ProblemTag(tagId)        — list problems for a given tag
-- 2) ContestProblem(problemId) — find which contests include a problem
-- 3) TestCase(problemId)       — load a problem's test cases (no existing idx)
--
-- Hand-written for Postgres; run via `prisma migrate deploy`.

CREATE INDEX IF NOT EXISTS "ProblemTag_tagId_idx"
  ON "ProblemTag" ("tagId");

CREATE INDEX IF NOT EXISTS "ContestProblem_problemId_idx"
  ON "ContestProblem" ("problemId");

CREATE INDEX IF NOT EXISTS "TestCase_problemId_idx"
  ON "TestCase" ("problemId");
