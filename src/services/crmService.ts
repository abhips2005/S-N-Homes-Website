/**
 * CRM Service — all data operations for the WhatsApp CRM layer.
 *
 * ARCHITECTURE:
 * Primary: The frontend calls the Express REST API backend (/api/v1/*)
 * configured via VITE_BACKEND_URL or local Vite proxy.
 * Fallback: If the backend is waking up (cold start) or unreachable,
 * it seamlessly falls back to direct Supabase queries with the user's session.
 */

import { supabase } from '../supabase-config';
import type {
  CrmCustomer,
  Conversation,
  ConversationState,
  CrmMessage,
  BuyerRequest,
  PropertyMatch,
  SellerSubmission,
  SellerDetails,
  FollowUpTask,
  JobQueueItem,
  JobType,
  DashboardSummary,
  BuyerLeadStatus,
  TaskStatus,
} from '../types/crm';

// ─── API Client ───────────────────────────────────────────────────────────────

const envBackend = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  ''
).trim().replace(/\/+$/, '');

// Clean root url without trailing /api or /api/v1
export const BACKEND_URL = envBackend.replace(/\/api(\/v1)?$/, '');
const BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Endpoint ${path} returned non-JSON (${res.status} ${contentType})`);
  }
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok) throw new Error(json.error ?? `Request failed: ${res.status}`);
  return json.data as T;
}

function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: 'GET' });
}
function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
}
function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export const CustomerService = {
  async getAll(): Promise<CrmCustomer[]> {
    try {
      return await apiGet<CrmCustomer[]>('/customers');
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for customers:', err);
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CrmCustomer[];
    }
  },
};

// ─── Conversation ─────────────────────────────────────────────────────────────

export const ConversationService = {
  async getAll(limitCount = 50, filters?: { status?: string; paused?: boolean }): Promise<Conversation[]> {
    try {
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (filters?.status) params.append('status', filters.status);
      if (filters?.paused !== undefined) params.append('paused', String(filters.paused));
      return await apiGet<Conversation[]>('/conversations?' + params.toString());
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for conversations:', err);
      let q = supabase
        .from('crm_conversations')
        .select(`
          *,
          customer:crm_customers(id, phone_e164, name)
        `)
        .order('last_message_at', { ascending: false })
        .limit(limitCount);
      if (filters?.status) q = q.eq('workflow_status', filters.status);
      if (filters?.paused !== undefined) q = q.eq('automation_paused', filters.paused);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Conversation[];
    }
  },

  async getMessages(conversationId: string, limitCount = 100): Promise<CrmMessage[]> {
    try {
      return await apiGet<CrmMessage[]>(`/conversations/${conversationId}/messages?limit=${limitCount}`);
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for messages:', err);
      const { data, error } = await supabase
        .from('crm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limitCount);
      if (error) throw error;
      return (data || []) as CrmMessage[];
    }
  },

  async reply(conversationId: string, to: string, message: string): Promise<void> {
    await apiPost(`/conversations/${conversationId}/reply`, { to, message });
  },

  async pause(conversationId: string): Promise<void> {
    try {
      await apiPost(`/conversations/${conversationId}/pause`);
    } catch (err) {
      console.warn('[CRM] apiPost failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_conversations')
        .update({ automation_paused: true })
        .eq('id', conversationId);
      if (error) throw error;
    }
  },

  async resume(conversationId: string): Promise<void> {
    try {
      await apiPost(`/conversations/${conversationId}/resume`);
    } catch (err) {
      console.warn('[CRM] apiPost failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_conversations')
        .update({ automation_paused: false })
        .eq('id', conversationId);
      if (error) throw error;
    }
  },

  async update(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'automation_paused' | 'assigned_to'>>
  ): Promise<void> {
    try {
      await apiPatch(`/conversations/${conversationId}`, updates);
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_conversations')
        .update(updates)
        .eq('id', conversationId);
      if (error) throw error;
    }
  },

  async updateState(
    id: string,
    _intent: string,
    _workflow_status: string,
    _state_snapshot: ConversationState
  ): Promise<void> {
    try {
      await apiPatch(`/conversations/${id}`, {
        intent: _intent,
        workflow_status: _workflow_status,
      });
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_conversations')
        .update({ intent: _intent, workflow_status: _workflow_status })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async setPaused(id: string, paused: boolean): Promise<void> {
    try {
      await apiPatch(`/conversations/${id}`, { automation_paused: paused });
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_conversations')
        .update({ automation_paused: paused })
        .eq('id', id);
      if (error) throw error;
    }
  },
};

// ─── Buyer Request ────────────────────────────────────────────────────────────

export const BuyerRequestService = {
  async getAll(limitCount = 100, status?: string): Promise<BuyerRequest[]> {
    try {
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (status) params.append('status', status);
      return await apiGet<BuyerRequest[]>('/buyer-requests?' + params.toString());
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for buyer requests:', err);
      let q = supabase
        .from('crm_buyer_requests')
        .select(`
          *,
          customer:crm_customers(id, phone_e164, name)
        `)
        .order('created_at', { ascending: false })
        .limit(limitCount);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BuyerRequest[];
    }
  },

  async getById(id: string): Promise<BuyerRequest & { matches: PropertyMatch[] }> {
    try {
      return await apiGet(`/buyer-requests/${id}`);
    } catch (err) {
      const { data, error } = await supabase
        .from('crm_buyer_requests')
        .select(`*, customer:crm_customers(id, phone_e164, name)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      const { data: matches } = await supabase
        .from('crm_property_matches')
        .select('*')
        .eq('buyer_request_id', id)
        .order('match_score', { ascending: false });
      return { ...data, matches: matches || [] } as BuyerRequest & { matches: PropertyMatch[] };
    }
  },

  async updateStatus(id: string, status: BuyerLeadStatus, notes?: string): Promise<void> {
    try {
      await apiPatch(`/buyer-requests/${id}`, { status, notes });
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (notes !== undefined) updates.notes = notes;
      const { error } = await supabase.from('crm_buyer_requests').update(updates).eq('id', id);
      if (error) throw error;
    }
  },

  async runMatching(id: string): Promise<{ matched: number }> {
    return apiPost(`/buyer-requests/${id}/matches`);
  },

  async getMatches(id: string): Promise<PropertyMatch[]> {
    try {
      return await apiGet<PropertyMatch[]>(`/buyer-requests/${id}/matches`);
    } catch (err) {
      const { data, error } = await supabase
        .from('crm_property_matches')
        .select('*')
        .eq('buyer_request_id', id)
        .order('match_score', { ascending: false });
      if (error) throw error;
      return (data || []) as PropertyMatch[];
    }
  },
};

// ─── Seller Submission ────────────────────────────────────────────────────────

export const SellerSubmissionService = {
  async getAll(limitCount = 100, status?: string): Promise<(SellerSubmission & { signed_image_urls: string[] })[]> {
    try {
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (status) params.append('status', status);
      return await apiGet(`/seller-submissions?` + params.toString());
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for seller submissions:', err);
      let q = supabase
        .from('crm_seller_submissions')
        .select(`
          *,
          customer:crm_customers(id, phone_e164, name)
        `)
        .order('created_at', { ascending: false })
        .limit(limitCount);
      if (status) q = q.eq('approval_status', status);
      const { data, error } = await q;
      if (error) throw error;

      const subs = (data || []) as any[];
      const enriched = await Promise.all(
        subs.map(async (s) => {
          const paths: string[] = s.image_paths || [];
          if (!paths.length) return { ...s, signed_image_urls: [] };
          const signedUrls: string[] = [];
          for (const p of paths) {
            const { data: urlData } = await supabase.storage
              .from('seller-submissions')
              .createSignedUrl(p, 3600);
            signedUrls.push(urlData?.signedUrl || p);
          }
          return { ...s, signed_image_urls: signedUrls };
        })
      );
      return enriched as (SellerSubmission & { signed_image_urls: string[] })[];
    }
  },

  async getById(id: string): Promise<SellerSubmission & { signed_image_urls: string[] }> {
    try {
      return await apiGet(`/seller-submissions/${id}`);
    } catch (err) {
      const { data, error } = await supabase
        .from('crm_seller_submissions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      const paths: string[] = data.image_paths || [];
      const signedUrls: string[] = [];
      for (const p of paths) {
        const { data: urlData } = await supabase.storage
          .from('seller-submissions')
          .createSignedUrl(p, 3600);
        signedUrls.push(urlData?.signedUrl || p);
      }
      return { ...data, signed_image_urls: signedUrls };
    }
  },

  async update(id: string, updates: Partial<{ review_notes: string; details: SellerDetails }>): Promise<void> {
    try {
      await apiPatch(`/seller-submissions/${id}`, updates);
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_seller_submissions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async approve(id: string, reviewer_id: string, review_notes?: string): Promise<void> {
    try {
      await apiPost(`/seller-submissions/${id}/approve`, { reviewer_id, review_notes });
    } catch (err) {
      console.warn('[CRM] apiPost failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_seller_submissions')
        .update({
          approval_status: 'approved',
          reviewed_by: reviewer_id,
          review_notes: review_notes ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async reject(id: string, reviewer_id: string, review_notes: string): Promise<void> {
    try {
      await apiPost(`/seller-submissions/${id}/reject`, { reviewer_id, review_notes });
    } catch (err) {
      console.warn('[CRM] apiPost failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_seller_submissions')
        .update({
          approval_status: 'rejected',
          reviewed_by: reviewer_id,
          review_notes: review_notes,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async requestMoreInfo(id: string, review_notes: string): Promise<void> {
    try {
      await apiPost(`/seller-submissions/${id}/request-info`, { review_notes });
    } catch (err) {
      console.warn('[CRM] apiPost failed, updating Supabase directly:', err);
      const { error } = await supabase
        .from('crm_seller_submissions')
        .update({
          approval_status: 'needs_more_information',
          review_notes: review_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    }
  },

  async publish(id: string): Promise<{ property_id: string; url: string }> {
    return apiPost(`/seller-submissions/${id}/publish`);
  },
};

// ─── Follow-Up Tasks ──────────────────────────────────────────────────────────

export const FollowUpService = {
  async getAll(limitCount = 200, status?: string): Promise<FollowUpTask[]> {
    try {
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (status) params.append('status', status);
      return await apiGet<FollowUpTask[]>('/follow-ups?' + params.toString());
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for follow-ups:', err);
      let q = supabase
        .from('crm_follow_up_tasks')
        .select(`
          *,
          customer:crm_customers(id, phone_e164, name)
        `)
        .order('due_at', { ascending: true })
        .limit(limitCount);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FollowUpTask[];
    }
  },

  async getDueToday(): Promise<FollowUpTask[]> {
    try {
      return await apiGet<FollowUpTask[]>('/follow-ups?status=pending&overdue=false');
    } catch (err) {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('crm_follow_up_tasks')
        .select(`*, customer:crm_customers(id, phone_e164, name)`)
        .eq('status', 'pending')
        .lte('due_at', endOfDay.toISOString())
        .order('due_at', { ascending: true });
      if (error) throw error;
      return (data || []) as FollowUpTask[];
    }
  },

  async create(task: Omit<FollowUpTask, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string }> {
    try {
      return await apiPost('/follow-ups', {
        customer_id: task.customer_id,
        conversation_id: task.buyer_request_id || null,
        task_type: task.task_type,
        due_at: task.due_at,
        notes: task.notes,
      });
    } catch (err) {
      console.warn('[CRM] apiPost failed, inserting into Supabase directly:', err);
      const { data, error } = await supabase
        .from('crm_follow_up_tasks')
        .insert({
          customer_id: task.customer_id,
          conversation_id: task.buyer_request_id || null,
          task_type: task.task_type,
          due_at: task.due_at,
          notes: task.notes,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id };
    }
  },

  async updateStatus(id: string, status: TaskStatus, notes?: string): Promise<void> {
    try {
      await apiPatch(`/follow-ups/${id}`, { status, notes });
    } catch (err) {
      console.warn('[CRM] apiPatch failed, updating Supabase directly:', err);
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (notes !== undefined) updates.notes = notes;
      const { error } = await supabase.from('crm_follow_up_tasks').update(updates).eq('id', id);
      if (error) throw error;
    }
  },
};

// ─── Job Queue ────────────────────────────────────────────────────────────────

export const JobQueueService = {
  /** Not used from the frontend — jobs are enqueued by the backend only. */
  async enqueue(_job_type: JobType, _payload: Record<string, unknown>): Promise<JobQueueItem> {
    throw new Error('JobQueueService.enqueue() must be called from the backend, not the browser.');
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    return await apiGet<DashboardSummary>('/dashboard/summary');
  } catch (err) {
    console.warn('[CRM] Falling back to direct Supabase query for summary:', err);
    const [buyersRes, sellersRes, convsRes, pausedRes, followupsRes, propsRes] = await Promise.all([
      supabase.from('crm_buyer_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('crm_seller_submissions').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_review'),
      supabase.from('crm_conversations').select('*', { count: 'exact', head: true }),
      supabase.from('crm_conversations').select('*', { count: 'exact', head: true }).eq('automation_paused', true),
      supabase.from('crm_follow_up_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).in('status', ['active', 'available']),
    ]);
    return {
      new_buyer_requests: buyersRes.count ?? 0,
      pending_seller_submissions: sellersRes.count ?? 0,
      active_conversations: convsRes.count ?? 0,
      conversations_needing_attention: pausedRes.count ?? 0,
      follow_ups_due_today: followupsRes.count ?? 0,
      failed_jobs: 0,
      published_properties: propsRes.count ?? 0,
    };
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const CrmNotificationService = {
  async getAll(): Promise<Array<{ id: string; subject: string; body: string; read: boolean; created_at: string }>> {
    try {
      return await apiGet('/notifications');
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for notifications:', err);
      const { data, error } = await supabase
        .from('crm_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Array<{ id: string; subject: string; body: string; read: boolean; created_at: string }>;
    }
  },

  async markRead(id: string): Promise<void> {
    try {
      await apiPost(`/notifications/${id}/read`);
    } catch (err) {
      const { error } = await supabase
        .from('crm_notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    }
  },
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const AuditLogService = {
  async getAll(limitCount = 100, entity?: string): Promise<unknown[]> {
    try {
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (entity) params.append('entity', entity);
      return await apiGet('/audit-logs?' + params.toString());
    } catch (err) {
      console.warn('[CRM] Falling back to direct Supabase query for audit logs:', err);
      let q = supabase
        .from('crm_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitCount);
      if (entity) q = q.eq('entity', entity);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  },
};

// ─── Aliases used by CrmInbox and CrmBuyerRequests pages ──────────────────────

/** Alias: MessageService — used by CrmInbox.tsx */
export const MessageService = {
  getForConversation: ConversationService.getMessages.bind(ConversationService),
  send: ConversationService.reply.bind(ConversationService),
};

/** Alias: PropertyMatchService — used by CrmBuyerRequests.tsx */
export const PropertyMatchService = {
  getForBuyerRequest: BuyerRequestService.getMatches.bind(BuyerRequestService),
  getForRequest: BuyerRequestService.getMatches.bind(BuyerRequestService), // alias
  runMatching: BuyerRequestService.runMatching.bind(BuyerRequestService),
};
