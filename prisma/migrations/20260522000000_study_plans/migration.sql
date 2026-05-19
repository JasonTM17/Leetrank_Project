-- LeetCode-style study plans.
--
-- 1) StudyPlan          — curated sequence of problems with metadata.
-- 2) StudyPlanProblem   — junction with `order` (global position) and
--                         `dayNumber` (LeetCode-style daily lesson grouping).
-- 3) UserStudyPlan      — per-user enrollment + progress tracking.
--
-- Hand-written for Postgres (prod). Idempotent so it survives re-runs and
-- can be replayed against partially-migrated environments.

-- 1) StudyPlan ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StudyPlan" (
  "id"             TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "difficulty"     TEXT NOT NULL,
  "estimatedHours" INTEGER NOT NULL DEFAULT 20,
  "coverImage"     TEXT,
  "isOfficial"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyPlan_slug_key"
  ON "StudyPlan" ("slug");
CREATE INDEX IF NOT EXISTS "StudyPlan_isOfficial_createdAt_idx"
  ON "StudyPlan" ("isOfficial", "createdAt");
CREATE INDEX IF NOT EXISTS "StudyPlan_difficulty_idx"
  ON "StudyPlan" ("difficulty");

-- 2) StudyPlanProblem -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "StudyPlanProblem" (
  "studyPlanId" TEXT NOT NULL,
  "problemId"   TEXT NOT NULL,
  "order"       INTEGER NOT NULL,
  "dayNumber"   INTEGER NOT NULL,

  CONSTRAINT "StudyPlanProblem_pkey" PRIMARY KEY ("studyPlanId", "problemId")
);

CREATE INDEX IF NOT EXISTS "StudyPlanProblem_studyPlanId_order_idx"
  ON "StudyPlanProblem" ("studyPlanId", "order");
CREATE INDEX IF NOT EXISTS "StudyPlanProblem_studyPlanId_dayNumber_idx"
  ON "StudyPlanProblem" ("studyPlanId", "dayNumber");
CREATE INDEX IF NOT EXISTS "StudyPlanProblem_problemId_idx"
  ON "StudyPlanProblem" ("problemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudyPlanProblem_studyPlanId_fkey'
  ) THEN
    ALTER TABLE "StudyPlanProblem"
      ADD CONSTRAINT "StudyPlanProblem_studyPlanId_fkey"
      FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudyPlanProblem_problemId_fkey'
  ) THEN
    ALTER TABLE "StudyPlanProblem"
      ADD CONSTRAINT "StudyPlanProblem_problemId_fkey"
      FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) UserStudyPlan --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "UserStudyPlan" (
  "userId"         TEXT NOT NULL,
  "studyPlanId"    TEXT NOT NULL,
  "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserStudyPlan_pkey" PRIMARY KEY ("userId", "studyPlanId")
);

CREATE INDEX IF NOT EXISTS "UserStudyPlan_userId_lastActivityAt_idx"
  ON "UserStudyPlan" ("userId", "lastActivityAt" DESC);
CREATE INDEX IF NOT EXISTS "UserStudyPlan_studyPlanId_idx"
  ON "UserStudyPlan" ("studyPlanId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserStudyPlan_userId_fkey'
  ) THEN
    ALTER TABLE "UserStudyPlan"
      ADD CONSTRAINT "UserStudyPlan_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserStudyPlan_studyPlanId_fkey'
  ) THEN
    ALTER TABLE "UserStudyPlan"
      ADD CONSTRAINT "UserStudyPlan_studyPlanId_fkey"
      FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
