/**
 * CRM Service — all data operations for the WhatsApp CRM layer.
 *
 * ARCHITECTURE: The frontend calls the Express REST API backend (/api/v1/*)
 * instead of hitting the database directly. This is more secure (no DB keys
 * in the browser) and the backend already exposes every endpoint needed.
 */

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

const BASE = '/api/v1';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  const json = await res.json() as { ok: boolean; data?: T; error?: string };
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
    return apiGet<CrmCustomer[]>('/customers');
  },
};

// ─── Conversation ─────────────────────────────────────────────────────────────

export const ConversationService = {
  async getAll(limitCount = 50, filters?: { status?: string; paused?: boolean }): Promise<Conversation[]> {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (filters?.status)  params.append('status', filters.status);
    if (filters?.paused !== undefined) params.append('paused', String(filters.paused));
    return apiGet<Conversation[]>('/conversations?' + params.toString());
  },

  async getMessages(conversationId: string, limitCount = 100): Promise<CrmMessage[]> {
    return apiGet<CrmMessage[]>(`/conversations/${conversationId}/messages?limit=${limitCount}`);
  },

  async reply(conversationId: string, to: string, message: string): Promise<void> {
    await apiPost(`/conversations/${conversationId}/reply`, { to, message });
  },

  async pause(conversationId: string): Promise<void> {
    await apiPost(`/conversations/${conversationId}/pause`);
  },

  async resume(conversationId: string): Promise<void> {
    await apiPost(`/conversations/${conversationId}/resume`);
  },

  async update(conversationId: string, updates: Partial<Pick<Conversation, 'automation_paused' | 'assigned_to'>>): Promise<void> {
    await apiPatch(`/conversations/${conversationId}`, updates);
  },

  async updateState(
    id: string,
    _intent: string,
    _workflow_status: string,
    _state_snapshot: ConversationState
  ): Promise<void> {
    await apiPatch(`/conversations/${id}`, {
      intent: _intent,
      workflow_status: _workflow_status,
    });
  },

  async setPaused(id: string, paused: boolean): Promise<void> {
    await apiPatch(`/conversations/${id}`, { automation_paused: paused });
  },
};

// ─── Buyer Request ────────────────────────────────────────────────────────────

export const BuyerRequestService = {
  async getAll(limitCount = 100, status?: string): Promise<BuyerRequest[]> {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (status) params.append('status', status);
    return apiGet<BuyerRequest[]>('/buyer-requests?' + params.toString());
  },

  async getById(id: string): Promise<BuyerRequest & { matches: PropertyMatch[] }> {
    return apiGet(`/buyer-requests/${id}`);
  },

  async updateStatus(id: string, status: BuyerLeadStatus, notes?: string): Promise<void> {
    await apiPatch(`/buyer-requests/${id}`, { status, notes });
  },

  async runMatching(id: string): Promise<{ matched: number }> {
    return apiPost(`/buyer-requests/${id}/matches`);
  },

  async getMatches(id: string): Promise<PropertyMatch[]> {
    return apiGet<PropertyMatch[]>(`/buyer-requests/${id}/matches`);
  },
};

// ─── Seller Submission ────────────────────────────────────────────────────────

export const SellerSubmissionService = {
  async getAll(limitCount = 100, status?: string): Promise<(SellerSubmission & { signed_image_urls: string[] })[]> {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (status) params.append('status', status);
    return apiGet(`/seller-submissions?` + params.toString());
  },

  async getById(id: string): Promise<SellerSubmission & { signed_image_urls: string[] }> {
    return apiGet(`/seller-submissions/${id}`);
  },

  async update(id: string, updates: Partial<{ review_notes: string; details: SellerDetails }>): Promise<void> {
    await apiPatch(`/seller-submissions/${id}`, updates);
  },

  async approve(id: string, reviewer_id: string, review_notes?: string): Promise<void> {
    await apiPost(`/seller-submissions/${id}/approve`, { reviewer_id, review_notes });
  },

  async reject(id: string, reviewer_id: string, review_notes: string): Promise<void> {
    await apiPost(`/seller-submissions/${id}/reject`, { reviewer_id, review_notes });
  },

  async requestMoreInfo(id: string, review_notes: string): Promise<void> {
    await apiPost(`/seller-submissions/${id}/request-info`, { review_notes });
  },

  async publish(id: string): Promise<{ property_id: string; url: string }> {
    return apiPost(`/seller-submissions/${id}/publish`);
  },
};

// ─── Follow-Up Tasks ──────────────────────────────────────────────────────────

export const FollowUpService = {
  async getAll(limitCount = 200, status?: string): Promise<FollowUpTask[]> {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (status) params.append('status', status);
    return apiGet<FollowUpTask[]>('/follow-ups?' + params.toString());
  },

  async getDueToday(): Promise<FollowUpTask[]> {
    return apiGet<FollowUpTask[]>('/follow-ups?status=pending&overdue=false');
  },

  async create(task: Omit<FollowUpTask, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string }> {
    return apiPost('/follow-ups', {
      customer_id: task.customer_id,
      conversation_id: task.buyer_request_id || null,
      task_type: task.task_type,
      due_at: task.due_at,
      notes: task.notes,
    });
  },

  async updateStatus(id: string, status: TaskStatus, notes?: string): Promise<void> {
    await apiPatch(`/follow-ups/${id}`, { status, notes });
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
  return apiGet<DashboardSummary>('/dashboard/summary');
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const CrmNotificationService = {
  async getAll(): Promise<Array<{ id: string; subject: string; body: string; read: boolean; created_at: string }>> {
    return apiGet('/notifications');
  },

  async markRead(id: string): Promise<void> {
    await apiPost(`/notifications/${id}/read`);
  },
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const AuditLogService = {
  async getAll(limitCount = 100, entity?: string): Promise<unknown[]> {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (entity) params.append('entity', entity);
    return apiGet('/audit-logs?' + params.toString());
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

