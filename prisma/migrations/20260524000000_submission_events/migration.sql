-- LeetCode-style code playback.
--
-- SubmissionEvent — append-only stream of editor events captured during a
-- coding session and flushed to the backend on submit. `ts` is a
-- millisecond offset from the session start so playback math is timezone-
-- and clock-skew independent. `payload` is jsonb so we can store the
-- event-specific shape without a per-type column explosion.
--
-- Hand-written for Postgres (prod). Idempotent so it survives re-runs.

CREATE TABLE IF NOT EXISTS "SubmissionEvent" (
  "id"           TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "payload"      JSONB NOT NULL,
  "ts"           INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubmissionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubmissionEvent_submissionId_ts_idx"
  ON "SubmissionEvent" ("submissionId", "ts");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubmissionEvent_submissionId_fkey'
  ) THEN
    ALTER TABLE "SubmissionEvent"
      ADD CONSTRAINT "SubmissionEvent_submissionId_fkey"
      FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
