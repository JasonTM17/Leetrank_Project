-- Daily challenge feature.
--
-- 1) DailyChallenge — exactly one row per UTC day. `date` is unique so the
--    cron picker is idempotent: re-running the workflow on the same UTC day
--    is a no-op (ON CONFLICT DO NOTHING in the picker query).
-- 2) DailyChallengeStreak — per-user streak tally. `userId` is the primary
--    key; we update via UPSERT from the submissions path when the day's
--    challenge problem is solved.
--
-- Hand-written for Postgres (prod). Idempotent so it survives re-runs.

-- 1) DailyChallenge -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DailyChallenge" (
  "id"              TEXT NOT NULL,
  "problemId"       TEXT NOT NULL,
  "date"            TIMESTAMP(3) NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completionCount" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyChallenge_date_key"
  ON "DailyChallenge" ("date");
CREATE INDEX IF NOT EXISTS "DailyChallenge_problemId_idx"
  ON "DailyChallenge" ("problemId");
CREATE INDEX IF NOT EXISTS "DailyChallenge_date_desc_idx"
  ON "DailyChallenge" ("date" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyChallenge_problemId_fkey'
  ) THEN
    ALTER TABLE "DailyChallenge"
      ADD CONSTRAINT "DailyChallenge_problemId_fkey"
      FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) DailyChallengeStreak -------------------------------------------------
CREATE TABLE IF NOT EXISTS "DailyChallengeStreak" (
  "userId"         TEXT NOT NULL,
  "currentStreak"  INTEGER NOT NULL DEFAULT 0,
  "longestStreak"  INTEGER NOT NULL DEFAULT 0,
  "lastSolvedDate" TIMESTAMP(3),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyChallengeStreak_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyChallengeStreak_userId_key"
  ON "DailyChallengeStreak" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyChallengeStreak_userId_fkey'
  ) THEN
    ALTER TABLE "DailyChallengeStreak"
      ADD CONSTRAINT "DailyChallengeStreak_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
