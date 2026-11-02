// ─────────────────────────────────────────────────────────────────────────────
// CRM entity types for the AI WhatsApp Real Estate CRM
// ─────────────────────────────────────────────────────────────────────────────

export type Intent = 'buy' | 'sell' | 'rent' | 'general' | 'unknown';

export type BuyerLeadStatus =
  | 'new'
  | 'contacted'
  | 'requirements_collected'
  | 'matching'
  | 'visit_scheduled'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'on_hold';

export type SellerReviewStatus =
  | 'incomplete'
  | 'pending_review'
  | 'needs_more_information'
  | 'approved'
  | 'rejected'
  | 'converted_to_listing';

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'template' | 'interactive' | 'status';
export type ProviderStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
export type WorkflowStatus =
  | 'idle'
  | 'collecting_requirements'
  | 'searching_properties'
  | 'awaiting_seller_details'
  | 'awaiting_seller_photos'
  | 'submitted'
  | 'escalated'
  | 'human_takeover';

export type TaskType = 'callback' | 'site_visit' | 'follow_up' | 'review_submission';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export type JobType =
  | 'process_inbound_message'
  | 'send_whatsapp_message'
  | 'run_property_matching'
  | 'download_media';
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'dead';

// ─── Customer ────────────────────────────────────────────────────────────────

export interface CrmCustomer {
  id: string;
  name?: string;
  phone_e164: string;
  whatsapp_opt_in_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationState {
  intent: Intent;
  workflow_status: WorkflowStatus;
  requirements?: Partial<BuyerRequirements>;
  seller_details?: Partial<SellerDetails>;
  missing_fields?: string[];
  last_question?: string;
}

export interface Conversation {
  id: string;
  customer_id: string;
  customer?: CrmCustomer;
  intent: Intent;
  workflow_status: WorkflowStatus;
  automation_paused: boolean;
  assigned_to?: string;
  last_message_at: string;
  created_at: string;
  state_snapshot?: ConversationState;
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface CrmMessage {
  id: string;
  conversation_id: string;
  provider_message_id?: string;
  direction: MessageDirection;
  message_type: MessageType;
  body?: string;
  media_url?: string;
  provider_status?: ProviderStatus;
  created_at: string;
}

// ─── Buyer request ────────────────────────────────────────────────────────────

export interface BuyerRequirements {
  property_type?: 'house' | 'flat' | 'apartment' | 'plot' | 'commercial' | 'villa' | 'other';
  purpose?: 'buy' | 'rent';
  district?: string;
  location?: string;
  locations?: string[];
  detail?: string;
  budget_label?: string;
  budget_min?: number;
  budget_max?: number;
  bedrooms_min?: number;
  land_area_min?: number;
  land_area_max?: number;
  built_up_area_min?: number;
  amenities?: string[];
  timeline?: string;
  furnished?: boolean;
  additional_notes?: string;
}

export interface BuyerRequest {
  id: string;
  customer_id: string;
  conversation_id: string;
  customer?: CrmCustomer;
  requirements: BuyerRequirements;
  status: BuyerLeadStatus;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── Property match ───────────────────────────────────────────────────────────

export interface PropertyMatch {
  id: string;
  buyer_request_id: string;
  property_id: string;
  property_title?: string;
  property_url?: string;
  match_score?: number;
  match_reason?: string;
  sent_at?: string;
  feedback?: 'interested' | 'not_interested' | 'visited';
  created_at: string;
}

// ─── Seller submission ────────────────────────────────────────────────────────

export interface SellerDetails {
  property_type?: string;
  district?: string;
  location?: string;
  detail?: string;
  land_area?: number;
  land_area_unit?: 'cent' | 'acre';
  built_up_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  rooms?: number;
  asking_price?: number;
  description?: string;
  road_access?: boolean;
  facilities?: string[];
  key_features?: string[];
}

export interface SellerSubmission {
  id: string;
  customer_id: string;
  conversation_id: string;
  customer?: CrmCustomer;
  details: SellerDetails;
  image_paths: string[];
  approval_status: SellerReviewStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  property_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Follow-up task ───────────────────────────────────────────────────────────

export interface FollowUpTask {
  id: string;
  customer_id: string;
  buyer_request_id?: string;
  seller_submission_id?: string;
  assigned_to?: string;
  due_at: string;
  task_type: TaskType;
  status: TaskStatus;
  notes?: string;
  customer?: CrmCustomer;
  created_at: string;
  updated_at: string;
}

// ─── Webhook event ────────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  provider_event_id?: string;
  received_at: string;
  processed_at?: string;
  status: 'pending' | 'processed' | 'failed';
  retry_count: number;
  last_error?: string;
  payload?: Record<string, unknown>;
}

// ─── Job queue ────────────────────────────────────────────────────────────────

export interface JobQueueItem {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  available_at: string;
  locked_at?: string;
  completed_at?: string;
  last_error?: string;
  idempotency_key?: string;
  created_at: string;
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

export interface DashboardSummary {
  new_buyer_requests: number;
  pending_seller_submissions: number;
  active_conversations: number;
  conversations_needing_attention: number;
  follow_ups_due_today: number;
  failed_jobs: number;
  published_properties: number;
}

// ─── AI extraction result ──────────────────────────────────────────────────────

export interface AIExtractionResult {
  intent?: Intent;
  buyer_requirements?: Partial<BuyerRequirements>;
  seller_details?: Partial<SellerDetails>;
  customer_name?: string;
  missing_fields?: string[];
  suggested_reply?: string;
  confidence?: number;
  requires_human?: boolean;
  requires_human_reason?: string;
}
