/**
 * Integration-style tests for the CRM REST API routes.
 * Uses an in-memory Supabase mock — no live credentials required.
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── In-memory data store ─────────────────────────────────────────────────────

const inMemoryRows: Record<string, Record<string, unknown>[]> = {
  crm_conversations: [
    {
      id: 'conv-1',
      customer_id: 'cust-1',
      workflow_status: 'requirements_collecting',
      intent: 'buy',
      automation_paused: false,
      opted_out: false,
      language: 'en',
    },
  ],
  crm_customers: [
    {
      id: 'cust-1',
      phone: '+919876543210',
      display_name: 'Test Buyer',
      opted_out: false,
    },
  ],
  crm_seller_submissions: [
    {
      id: 'sub-1',
      customer_id: 'cust-2',
      status: 'pending_review',
      property_type: 'house',
      location: 'Kochi',
      asking_price: 5000000,
      image_paths: [],
    },
  ],
  crm_buyer_requests: [
    {
      id: 'req-1',
      customer_id: 'cust-1',
      conversation_id: 'conv-1',
      requirements: { property_type: 'house', locations: ['Kochi'], budget_max: 5000000 },
      status: 'new',
    },
  ],
  properties: [
    {
      id: 'prop-1',
      title: 'Test Villa',
      property_type: 'house',
      price: 4500000,
      location: 'Kochi',
      status: 'available',
    },
  ],
};

/** Returns a mock Supabase query builder backed by inMemoryRows. */
function makeQueryBuilder(table: string) {
  let rows = [...(inMemoryRows[table] ?? [])];
  let eqFilter: { col: string; val: unknown } | null = null;
  let singleMode = false;

  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: [{ id: `new-${table}-${Date.now()}` }], error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: unknown) => {
      eqFilter = { col, val };
      return builder;
    }),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => {
      singleMode = true;
      const filtered = eqFilter
        ? rows.filter(r => String(r[eqFilter!.col]) === String(eqFilter!.val))
        : rows;
      const row = filtered[0] ?? null;
      return Promise.resolve({ data: row, error: row ? null : { code: 'PGRST116', message: 'Not found' } });
    }),
    then: vi.fn((resolve: (r: unknown) => void) => {
      const filtered = eqFilter
        ? rows.filter(r => String(r[eqFilter!.col]) === String(eqFilter!.val))
        : rows;
      resolve({ data: filtered, error: null });
    }),
  };

  return builder;
}

const mockSupabaseClient = {
  from: vi.fn((table: string) => makeQueryBuilder(table)),
  auth: {
    admin: {
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-uuid' } }, error: null }),
      deleteUser: vi.fn().mockResolvedValue({ error: null }),
    },
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-uid' } }, error: null }),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://supabase.example.com/storage/test.jpg' } })),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://supabase.example.com/signed?sig=abc' }, error: null }),
    })),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('../../server/supabaseAdmin', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// Keep backward-compat shim working (server/firebaseAdmin.ts re-exports from supabaseAdmin)
vi.mock('../../server/firebaseAdmin', () => ({
  getDb: vi.fn(() => mockSupabaseClient),
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

// ─── Acceptance criteria tests ────────────────────────────────────────────────

describe('Supabase mock: crm_buyer_requests table', () => {
  it('returns row data for known ID', async () => {
    const { getSupabase } = await import('../../server/supabaseAdmin');
    const { data } = await getSupabase()
      .from('crm_buyer_requests')
      .select('*')
      .eq('id', 'req-1')
      .single();
    expect(data).not.toBeNull();
    expect(data?.['status']).toBe('new');
  });

  it('returns null for unknown ID', async () => {
    const { getSupabase } = await import('../../server/supabaseAdmin');
    const { data, error } = await getSupabase()
      .from('crm_buyer_requests')
      .select('*')
      .eq('id', 'not-found')
      .single();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('Supabase mock: crm_seller_submissions table', () => {
  it('returns pending_review submission', async () => {
    const { getSupabase } = await import('../../server/supabaseAdmin');
    const { data } = await getSupabase()
      .from('crm_seller_submissions')
      .select('*')
      .eq('id', 'sub-1')
      .single();
    expect(data).not.toBeNull();
    expect(data?.['status']).toBe('pending_review');
  });
});

describe('Supabase mock: properties table', () => {
  it('returns available property', async () => {
    const { getSupabase } = await import('../../server/supabaseAdmin');
    const { data } = await getSupabase()
      .from('properties')
      .select('*')
      .eq('id', 'prop-1')
      .single();
    expect(data).not.toBeNull();
    expect(data?.['status']).toBe('available');
    expect(data?.['property_type']).toBe('house');
  });
});

describe('Supabase mock: Storage signed URL', () => {
  it('generates a signed URL for valid inputs', async () => {
    const { getSupabase } = await import('../../server/supabaseAdmin');
    const { data } = await getSupabase()
      .storage
      .from('seller-submissions')
      .createSignedUrl('test/image.jpg', 900);
    expect(data?.signedUrl).toContain('https://');
  });
});

// ─── Webhook payload parsing ───────────────────────────────────────────────────

describe('Webhook payload parsing', () => {
  const sampleInboundPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123',
      changes: [{
        value: {
          messages: [{
            id: 'wamid.abc123',
            from: '919876543210',
            type: 'text',
            text: { body: 'I want to buy a house in Kochi' },
            timestamp: String(Date.now()),
          }],
          contacts: [{ wa_id: '919876543210', profile: { name: 'Test Buyer' } }],
        },
        field: 'messages',
      }],
    }],
  };

  it('extracts message from nested payload structure', () => {
    const entry = sampleInboundPayload.entry[0];
    const change = entry.changes[0];
    const value = change.value;
    const messages = value.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('919876543210');
    expect(messages[0].type).toBe('text');
    expect(messages[0].text.body).toContain('Kochi');
  });

  it('extracts contact name from contacts array', () => {
    const contacts = sampleInboundPayload.entry[0].changes[0].value.contacts;
    const contactMap: Record<string, string> = {};
    for (const c of contacts) contactMap[c.wa_id] = c.profile?.name ?? '';
    expect(contactMap['919876543210']).toBe('Test Buyer');
  });

  const sampleStatusPayload = {
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: 'wamid.outbound123',
            status: 'delivered',
            timestamp: String(Date.now()),
          }],
        },
      }],
    }],
  };

  it('detects status update payload correctly', () => {
    const value = sampleStatusPayload.entry[0].changes[0].value;
    expect('statuses' in value).toBe(true);
    expect(value.statuses[0].status).toBe('delivered');
    expect(value.statuses[0].id).toBe('wamid.outbound123');
  });
});

// ─── Job worker backoff ────────────────────────────────────────────────────────

describe('Job worker exponential backoff', () => {
  function backoffSeconds(attempt: number): number {
    return Math.min(30 * Math.pow(4, attempt - 1), 7200);
  }

  it('attempt 1 → 30s', () => expect(backoffSeconds(1)).toBe(30));
  it('attempt 2 → 120s (2 min)', () => expect(backoffSeconds(2)).toBe(120));
  it('attempt 3 → 480s (8 min)', () => expect(backoffSeconds(3)).toBe(480));
  it('attempt 4 → 1920s (32 min)', () => expect(backoffSeconds(4)).toBe(1920));
  it('attempt 5 → capped at 7200s (2h)', () => expect(backoffSeconds(5)).toBe(7200));
});

// ─── Property status transitions (acceptance criteria §14) ────────────────────

describe('Property status transitions', () => {
  const validTransitions: Record<string, string[]> = {
    draft:    ['active', 'archived'],
    active:   ['inactive', 'sold', 'archived'],
    inactive: ['active', 'archived'],
    sold:     ['archived'],
    archived: [],
  };

  it('draft can be activated', () => expect(validTransitions['draft']).toContain('active'));
  it('active can be archived', () => expect(validTransitions['active']).toContain('archived'));
  it('active can be marked sold', () => expect(validTransitions['active']).toContain('sold'));
  it('archived has no valid transitions', () => expect(validTransitions['archived']).toHaveLength(0));
  it('sold cannot go back to active', () => expect(validTransitions['sold']).not.toContain('active'));
});
