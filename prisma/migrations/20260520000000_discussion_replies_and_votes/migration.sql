-- Discussion replies + per-user votes (LeetCode-parity).
--
-- 1) DiscussionComment.parentId — self-referencing FK enabling nested replies.
--    Application caps depth at 3 levels (see API). ON DELETE CASCADE so
--    deleting a parent comment removes its sub-tree.
-- 2) DiscussionVote — per-user (-1 / +1) tally for a discussion. UNIQUE
--    (discussionId, userId) makes vote toggles idempotent at the DB layer.
--
-- Hand-written for Postgres (prod). Idempotent so it survives re-runs.

-- 1) Add parentId to DiscussionComment ------------------------------------
ALTER TABLE "DiscussionComment"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionComment_parentId_fkey'
  ) THEN
    ALTER TABLE "DiscussionComment"
      ADD CONSTRAINT "DiscussionComment_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "DiscussionComment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DiscussionComment_parentId_idx"
  ON "DiscussionComment" ("parentId");

-- 2) DiscussionVote -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DiscussionVote" (
  "id"           TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "value"        INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscussionVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscussionVote_discussionId_userId_key"
  ON "DiscussionVote" ("discussionId", "userId");

CREATE INDEX IF NOT EXISTS "DiscussionVote_discussionId_idx"
  ON "DiscussionVote" ("discussionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionVote_discussionId_fkey'
  ) THEN
    ALTER TABLE "DiscussionVote"
      ADD CONSTRAINT "DiscussionVote_discussionId_fkey"
      FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionVote_userId_fkey'
  ) THEN
    ALTER TABLE "DiscussionVote"
      ADD CONSTRAINT "DiscussionVote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
