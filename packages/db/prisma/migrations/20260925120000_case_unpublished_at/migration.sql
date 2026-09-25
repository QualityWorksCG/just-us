-- A plaintiff pausing their live case's public page. Set while paused, null
-- while public. Orthogonal to `status` (still `live`) and to moderation.
ALTER TABLE "case" ADD COLUMN "unpublishedAt" TIMESTAMP(3);
