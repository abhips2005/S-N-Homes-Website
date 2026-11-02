-- ============================================================================
-- 003 — Admin RLS Policies for CRM Tables and Storage
-- Allows authenticated administrators to view and manage CRM data directly
-- from the frontend if the Render backend is cold/sleeping.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Helper function: check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR (auth.jwt() ->> 'email') = 'abhips1108@gmail.com'
  );
END;
$$;

-- 2. CRM Customers
DROP POLICY IF EXISTS "admin_crm_customers" ON crm_customers;
CREATE POLICY "admin_crm_customers" ON crm_customers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 3. CRM Conversations
DROP POLICY IF EXISTS "admin_crm_conversations" ON crm_conversations;
CREATE POLICY "admin_crm_conversations" ON crm_conversations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. CRM Messages
DROP POLICY IF EXISTS "admin_crm_messages" ON crm_messages;
CREATE POLICY "admin_crm_messages" ON crm_messages
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 5. CRM Buyer Requests
DROP POLICY IF EXISTS "admin_crm_buyer_requests" ON crm_buyer_requests;
CREATE POLICY "admin_crm_buyer_requests" ON crm_buyer_requests
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 6. CRM Seller Submissions
DROP POLICY IF EXISTS "admin_crm_seller_submissions" ON crm_seller_submissions;
CREATE POLICY "admin_crm_seller_submissions" ON crm_seller_submissions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 7. CRM Follow-up Tasks
DROP POLICY IF EXISTS "admin_crm_follow_up_tasks" ON crm_follow_up_tasks;
CREATE POLICY "admin_crm_follow_up_tasks" ON crm_follow_up_tasks
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 8. CRM Notifications
DROP POLICY IF EXISTS "admin_crm_notifications" ON crm_notifications;
CREATE POLICY "admin_crm_notifications" ON crm_notifications
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 9. CRM Audit Logs
DROP POLICY IF EXISTS "admin_crm_audit_logs" ON crm_audit_logs;
CREATE POLICY "admin_crm_audit_logs" ON crm_audit_logs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 10. CRM Property Matches
DROP POLICY IF EXISTS "admin_crm_property_matches" ON crm_property_matches;
CREATE POLICY "admin_crm_property_matches" ON crm_property_matches
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 11. Storage bucket & access for seller submission property photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-submissions', 'seller-submissions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_read_seller_submissions_storage" ON storage.objects;
CREATE POLICY "admin_read_seller_submissions_storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seller-submissions' AND is_admin());
