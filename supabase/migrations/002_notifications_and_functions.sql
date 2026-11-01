-- ============================================================================
-- 002 — Supplementary tables and functions
-- Run AFTER 001_initial_schema.sql
-- ============================================================================

-- ─── Admin Notifications (broadcast records sent by admin) ───────────────────
CREATE TABLE IF NOT EXISTS admin_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT DEFAULT 'system' CHECK (type IN ('system', 'property', 'price', 'news')),
  target_users    TEXT NOT NULL,       -- all | specific | byLocation | byActivity
  target_user_ids TEXT[] DEFAULT '{}',
  target_location TEXT,
  sent_count      INTEGER DEFAULT 0,
  read_count      INTEGER DEFAULT 0,
  created_by      TEXT NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
-- Admin notifications are backend-only (no anon access)

-- ─── Increment property views (atomic, avoids race conditions) ───────────────
CREATE OR REPLACE FUNCTION increment_property_views(property_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE properties SET views = views + 1 WHERE id = property_id;
END;
$$;

-- ─── Auto-increment read_count on admin_notifications when user reads ────────
-- (Optional — can be triggered from backend instead)

-- ─── Index for notifications ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read    ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifs_created ON admin_notifications(created_at DESC);
