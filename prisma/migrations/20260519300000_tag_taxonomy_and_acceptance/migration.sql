-- LeetCode-style tag taxonomy + problem acceptance rate.
--
-- 1) Tag.category — partitions tags into "topic" (algorithm/data-structure),
--    "company" (interview source), "skill" (language/runtime). Existing rows
--    default to "topic" so the seeded DSA tag set keeps working without a
--    backfill script.
-- 2) Problem.acceptanceRate — share of accepted submissions, 0..1. Null until
--    src/lib/acceptance-rate.ts refreshes it; ranking pages sort on this so
--    the index keeps the scan cheap.

ALTER TABLE "Tag"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'topic';

CREATE INDEX IF NOT EXISTS "Tag_category_idx" ON "Tag" ("category");

ALTER TABLE "Problem"
  ADD COLUMN IF NOT EXISTS "acceptanceRate" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Problem_acceptanceRate_idx"
  ON "Problem" ("acceptanceRate");
