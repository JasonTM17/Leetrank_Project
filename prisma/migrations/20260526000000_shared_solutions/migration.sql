-- Shared solutions (LeetCode-parity solution sharing).
--
-- 1) SharedSolution — author-published writeup tied to an accepted submission.
--    `submissionId` is UNIQUE so the same submission can't be reposted; the
--    accepted-status check happens at the API layer (Submission.status).
-- 2) SharedSolutionVote — per-user (-1 / +1) tally with composite PK so vote
--    toggles are idempotent at the DB layer. `voteCount` on SharedSolution
--    mirrors aggregate(sum(value)) for cheap list-sort by "top".
--
-- Hand-written for Postgres (prod). Idempotent so it survives re-runs.
-- Pairs with the SharedSolution / SharedSolutionVote models in
-- prisma/schema.prisma — when those land, run `prisma migrate resolve`.

-- 1) SharedSolution -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SharedSolution" (
  "id"           TEXT NOT NULL,
  "problemId"    TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "writeup"      TEXT NOT NULL,
  "language"     TEXT NOT NULL,
  "voteCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SharedSolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SharedSolution_submissionId_key"
  ON "SharedSolution" ("submissionId");

CREATE INDEX IF NOT EXISTS "SharedSolution_problemId_voteCount_idx"
  ON "SharedSolution" ("problemId", "voteCount" DESC);

CREATE INDEX IF NOT EXISTS "SharedSolution_problemId_createdAt_idx"
  ON "SharedSolution" ("problemId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SharedSolution_userId_createdAt_idx"
  ON "SharedSolution" ("userId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedSolution_problemId_fkey'
  ) THEN
    ALTER TABLE "SharedSolution"
      ADD CONSTRAINT "SharedSolution_problemId_fkey"
      FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedSolution_userId_fkey'
  ) THEN
    ALTER TABLE "SharedSolution"
      ADD CONSTRAINT "SharedSolution_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedSolution_submissionId_fkey'
  ) THEN
    ALTER TABLE "SharedSolution"
      ADD CONSTRAINT "SharedSolution_submissionId_fkey"
      FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) SharedSolutionVote ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "SharedSolutionVote" (
  "userId"     TEXT NOT NULL,
  "solutionId" TEXT NOT NULL,
  "value"      INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SharedSolutionVote_pkey" PRIMARY KEY ("userId", "solutionId")
);

CREATE INDEX IF NOT EXISTS "SharedSolutionVote_solutionId_idx"
  ON "SharedSolutionVote" ("solutionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedSolutionVote_userId_fkey'
  ) THEN
    ALTER TABLE "SharedSolutionVote"
      ADD CONSTRAINT "SharedSolutionVote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedSolutionVote_solutionId_fkey'
  ) THEN
    ALTER TABLE "SharedSolutionVote"
      ADD CONSTRAINT "SharedSolutionVote_solutionId_fkey"
      FOREIGN KEY ("solutionId") REFERENCES "SharedSolution"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
