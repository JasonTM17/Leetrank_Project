-- Glicko-2 rating + Codeforces-style contest divisions per ADR 0021.
--
-- New columns on User: rating, maxRating, ratingDeviation, ratingVolatility.
-- Defaults match the Glicko-2 newcomer band (1500/350/0.06).
-- New column on Contest: division (nullable; legacy contests stay open).
-- New table RatingChange: per-contest rating delta snapshot.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS "maxRating" INTEGER NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS "ratingDeviation" INTEGER NOT NULL DEFAULT 350,
  ADD COLUMN IF NOT EXISTS "ratingVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06;

CREATE INDEX IF NOT EXISTS "User_rating_idx" ON "User" ("rating" DESC);

ALTER TABLE "Contest"
  ADD COLUMN IF NOT EXISTS "division" TEXT;

CREATE INDEX IF NOT EXISTS "Contest_division_startTime_idx"
  ON "Contest" ("division", "startTime");

CREATE TABLE IF NOT EXISTS "RatingChange" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "contestId"    TEXT NOT NULL,
  "beforeRating" INTEGER NOT NULL,
  "afterRating"  INTEGER NOT NULL,
  "delta"        INTEGER NOT NULL,
  "rank"         INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RatingChange_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "User" ("id")    ON DELETE CASCADE,
  CONSTRAINT "RatingChange_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RatingChange_contestId_userId_key"
  ON "RatingChange" ("contestId", "userId");

CREATE INDEX IF NOT EXISTS "RatingChange_userId_createdAt_idx"
  ON "RatingChange" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "RatingChange_contestId_idx"
  ON "RatingChange" ("contestId");
