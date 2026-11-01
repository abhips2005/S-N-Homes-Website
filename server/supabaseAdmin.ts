/**
 * Supabase Admin Client — server-side only.
 * Uses the SERVICE ROLE key which bypasses Row Level Security.
 * Never expose this key to the browser.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('[Supabase Admin] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    }
    _client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Supabase Admin] Client initialised');
  }
  return _client;
}

/** Write an immutable audit record to crm_audit_logs */
export async function writeAudit(
  action: string,
  entity: string,
  entity_id: string,
  actor: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from('crm_audit_logs')
      .insert({
        action,
        entity,
        entity_id,
        actor,
        details: details ?? null,
        created_at: new Date().toISOString(),
      });
    if (error) console.error('[Audit] write failed:', error.message);
  } catch (e) {
    console.error('[Audit] unexpected error:', e);
  }
}
