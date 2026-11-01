-- ============================================================================
-- S&N Homes — Supabase PostgreSQL Schema
-- Migrated from Firebase Firestore. Run this in Supabase SQL Editor.
-- ============================================================================

-- ─── Users (mirrors Firebase Auth UIDs via Supabase Auth) ────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT,
  email        TEXT UNIQUE NOT NULL,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'agent', 'admin')),
  phone_verified     BOOLEAN DEFAULT FALSE,
  verified           BOOLEAN DEFAULT TRUE,
  saved_properties   TEXT[]  DEFAULT '{}',
  viewing_history    TEXT[]  DEFAULT '{}',
  profile_image_url  TEXT,
  last_login         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Properties ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  description          TEXT DEFAULT '',
  price                NUMERIC(14,2),
  property_type        TEXT,           -- house | flat | plot | commercial | villa | land
  property_listing_type TEXT,          -- buy | rent | lease
  location             TEXT,
  district             TEXT,
  bedrooms             INTEGER,
  bathrooms            INTEGER,
  area                 NUMERIC,        -- built-up area (sq ft)
  land_area            NUMERIC,
  land_area_unit       TEXT DEFAULT 'cent',
  images               TEXT[]  DEFAULT '{}',
  features             TEXT[]  DEFAULT '{}',
  amenities            TEXT[]  DEFAULT '{}',
  furnished            TEXT DEFAULT 'Not Applicable',
  nearby_places        JSONB   DEFAULT '[]',
  virtual_tour_url     TEXT,
  construction_year    INTEGER,
  last_renovated       TEXT,
  parking_spaces       INTEGER,
  coordinates          JSONB,          -- { latitude, longitude }
  status               TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'rented', 'active', 'draft', 'archived')),
  is_premium           BOOLEAN DEFAULT FALSE,
  views                INTEGER DEFAULT 0,
  user_id              UUID REFERENCES users(id),
  source               TEXT DEFAULT 'manual',
  seller_submission_id UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Notifications (website-level, not CRM) ─────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT DEFAULT 'system' CHECK (type IN ('system', 'property', 'price', 'news')),
  read        BOOLEAN DEFAULT FALSE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Customers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164          TEXT UNIQUE NOT NULL,
  name                TEXT,
  opted_out           BOOLEAN DEFAULT FALSE,
  whatsapp_opt_in_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES crm_customers(id),
  intent                TEXT DEFAULT 'unknown',
  workflow_status       TEXT DEFAULT 'new',
  automation_paused     BOOLEAN DEFAULT FALSE,
  opted_out             BOOLEAN DEFAULT FALSE,
  language              TEXT DEFAULT 'en',
  buyer_data            JSONB,
  seller_data           JSONB,
  pending_submission_id UUID,
  notes                 TEXT,
  assigned_to           TEXT,
  last_message_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES crm_conversations(id),
  customer_id         UUID NOT NULL REFERENCES crm_customers(id),
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type        TEXT NOT NULL DEFAULT 'text',
  body                TEXT,
  provider_message_id TEXT UNIQUE,
  media_id            TEXT,
  media_mime_type     TEXT,
  provider_status     TEXT DEFAULT 'received',
  status_updated_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Webhook Events (inbound deduplication) ───────────────────────────────
CREATE TABLE IF NOT EXISTS crm_webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id TEXT UNIQUE NOT NULL,
  from_phone          TEXT,
  body                TEXT,
  media_id            TEXT,
  processed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Buyer Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_buyer_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES crm_customers(id),
  conversation_id UUID NOT NULL REFERENCES crm_conversations(id),
  requirements    JSONB NOT NULL DEFAULT '{}',
  status          TEXT DEFAULT 'new',
  notes           TEXT,
  assigned_to     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Property Matches ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_property_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES crm_conversations(id),
  buyer_request_id UUID REFERENCES crm_buyer_requests(id),
  property_id      TEXT NOT NULL,
  property_title   TEXT,
  property_url     TEXT,
  match_score      NUMERIC,
  match_reason     TEXT,
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  feedback         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Seller Submissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_seller_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES crm_customers(id),
  conversation_id UUID NOT NULL REFERENCES crm_conversations(id),
  details         JSONB DEFAULT '{}',
  image_paths     TEXT[] DEFAULT '{}',   -- storage paths (not signed URLs)
  approval_status TEXT DEFAULT 'incomplete',
  reviewer_id     TEXT,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  property_id     UUID REFERENCES properties(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Follow-Up Tasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_follow_up_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES crm_customers(id),
  conversation_id     UUID REFERENCES crm_conversations(id),
  buyer_request_id    UUID REFERENCES crm_buyer_requests(id),
  seller_submission_id UUID REFERENCES crm_seller_submissions(id),
  assigned_to         TEXT,
  task_type           TEXT NOT NULL,
  status              TEXT DEFAULT 'pending',
  due_at              TIMESTAMPTZ NOT NULL,
  notes               TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Notifications (owner alerts) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Audit Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor     TEXT NOT NULL,
  details   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Job Queue ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_job_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'locked', 'completed', 'failed', 'dead')),
  attempts     INTEGER DEFAULT 0,
  available_at TIMESTAMPTZ DEFAULT NOW(),
  locked_at    TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CRM Outbound Idempotency (1h TTL — filtered by expires_at in queries) ────
CREATE TABLE IF NOT EXISTS crm_outbound_idempotency (
  id         TEXT PRIMARY KEY,             -- SHA-256 hash key
  wamid      TEXT,
  to_phone   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ─── CRM Template Messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_template_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone      TEXT NOT NULL,
  template_name TEXT NOT NULL,
  variables     TEXT[] DEFAULT '{}',
  language_code TEXT DEFAULT 'en',
  wamid         TEXT,
  status        TEXT DEFAULT 'sent',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_status        ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type          ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_price         ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_created       ON properties(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_customers_phone      ON crm_customers(phone_e164);
CREATE INDEX IF NOT EXISTS idx_crm_convs_customer       ON crm_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_convs_last_msg       ON crm_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_convs_paused         ON crm_conversations(automation_paused);
CREATE INDEX IF NOT EXISTS idx_crm_convs_status         ON crm_conversations(workflow_status);

CREATE INDEX IF NOT EXISTS idx_crm_msgs_conversation    ON crm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_msgs_created         ON crm_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_crm_msgs_provider_id     ON crm_messages(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_crm_buyer_status         ON crm_buyer_requests(status);
CREATE INDEX IF NOT EXISTS idx_crm_buyer_customer       ON crm_buyer_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_seller_status        ON crm_seller_submissions(approval_status);
CREATE INDEX IF NOT EXISTS idx_crm_seller_customer      ON crm_seller_submissions(customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_due            ON crm_follow_up_tasks(due_at ASC);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status         ON crm_follow_up_tasks(status);

CREATE INDEX IF NOT EXISTS idx_crm_job_queue_status     ON crm_job_queue(status, available_at ASC);
CREATE INDEX IF NOT EXISTS idx_crm_job_locked           ON crm_job_queue(locked_at) WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS idx_crm_idem_expires         ON crm_outbound_idempotency(expires_at);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- The backend uses the service role key (bypasses RLS).
-- Frontend (anon key) only touches: users (own row), properties (public read), notifications (own rows).

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;

-- All CRM tables are backend-only (service role) — no anon access.
ALTER TABLE crm_customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_webhook_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_buyer_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_property_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_seller_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_follow_up_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_job_queue          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_outbound_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_template_messages  ENABLE ROW LEVEL SECURITY;

-- Users: each user can read/update only their own row
CREATE POLICY "users_own_row_select" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_own_row_update" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own"     ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties: public can read active/available, authenticated users can insert/update own
CREATE POLICY "properties_public_read"  ON properties FOR SELECT USING (status IN ('active', 'available'));
CREATE POLICY "properties_auth_insert"  ON properties FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "properties_own_update"   ON properties FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IN (
  SELECT id FROM users WHERE role = 'admin'
));

-- Notifications: users see only their own
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- ─── Trigger: auto-update updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON users                  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at     BEFORE UPDATE ON properties             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_crm_customers_updated_at  BEFORE UPDATE ON crm_customers          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_crm_buyer_updated_at      BEFORE UPDATE ON crm_buyer_requests     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_crm_seller_updated_at     BEFORE UPDATE ON crm_seller_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_crm_tasks_updated_at      BEFORE UPDATE ON crm_follow_up_tasks    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
