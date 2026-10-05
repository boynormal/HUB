-- Thai has no word boundaries, so a text search configuration cannot tokenise it.
-- Trigram similarity is what makes search usable for Thai and for partial words.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS communication_posts_title_trgm_idx
  ON communication_posts USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS communication_posts_summary_trgm_idx
  ON communication_posts USING gin (summary gin_trgm_ops);

CREATE INDEX IF NOT EXISTS communication_posts_content_trgm_idx
  ON communication_posts USING gin (content gin_trgm_ops);

-- The My Tasks list and every acknowledgement report read only the rows that are still pending.
CREATE INDEX IF NOT EXISTS communication_post_receipts_pending_idx
  ON communication_post_receipts (user_id, post_id)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS communication_post_receipts_unread_idx
  ON communication_post_receipts (user_id, post_id)
  WHERE read_at IS NULL;

-- The worker polls for due reminders that have not been sent.
CREATE INDEX IF NOT EXISTS communication_post_reminders_due_idx
  ON communication_post_reminders (run_at)
  WHERE sent_at IS NULL;

-- The notification badge counts unread rows only.
CREATE INDEX IF NOT EXISTS communication_notifications_unread_idx
  ON communication_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- The scheduler looks for drafts whose publish time has arrived.
CREATE INDEX IF NOT EXISTS communication_posts_due_schedule_idx
  ON communication_posts (scheduled_at)
  WHERE status = 'SCHEDULED' AND deleted_at IS NULL;

-- The feed always filters out deleted posts.
CREATE INDEX IF NOT EXISTS communication_posts_live_idx
  ON communication_posts (topic_id, published_at DESC)
  WHERE deleted_at IS NULL;

-- pg-boss keeps its own tables. Prisma never manages this schema.
CREATE SCHEMA IF NOT EXISTS pgboss;
