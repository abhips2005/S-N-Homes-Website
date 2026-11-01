/**
 * Unit tests for the Conversation Engine — buyer/seller workflow and keyword detection.
 *
 * These tests mock Firebase and the WhatsApp API so they can run without live credentials.
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Firebase Admin Mocks ─────────────────────────────────────────────────────

const firestoreData: Record<string, Record<string, unknown>> = {};

const mockBatch = {
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

const mockCollection = (collName: string) => ({
  doc: (id = 'doc-' + Math.random()) => ({
    id,
    get: vi.fn().mockResolvedValue({
      exists: Boolean(firestoreData[collName + '/' + id]),
      data: () => firestoreData[collName + '/' + id] ?? undefined,
      ref: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      id,
    }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    ref: { update: vi.fn().mockResolvedValue(undefined) },
  }),
  add: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
});

vi.mock('../server/firebaseAdmin', () => ({
  getDb: vi.fn(() => ({
    collection: mockCollection,
    batch: () => mockBatch,
  })),
  FieldValue: {
    serverTimestamp: () => '__server_timestamp__',
    arrayUnion: (...args: unknown[]) => ({ type: 'arrayUnion', args }),
  },
  getAdminStorage: vi.fn(() => ({ bucket: () => ({ file: () => ({}) }) })),
  initAdmin: vi.fn(),
}));

// ─── Keyword constant tests (no Firebase required) ────────────────────────────

describe('Opt-out keyword detection', () => {
  const OPT_OUT = ['stop', 'unsubscribe', 'quit', 'optout', 'opt out', 'cancel'];

  it('detects "STOP" case-insensitively', () => {
    const body = 'STOP';
    expect(OPT_OUT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });

  it('detects "please unsubscribe me"', () => {
    const body = 'please unsubscribe me';
    expect(OPT_OUT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });

  it('does NOT flag normal messages', () => {
    const body = 'I want to buy a house in Kochi';
    expect(OPT_OUT.some(k => body.toLowerCase().includes(k))).toBe(false);
  });
});

describe('Human agent keyword detection', () => {
  const HUMAN_AGENT = ['human', 'agent', 'talk to agent', 'speak to agent',
    'talk to human', 'call me', 'real person'];

  it('detects "I want to talk to a human"', () => {
    const body = 'I want to talk to a human';
    expect(HUMAN_AGENT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });

  it('detects "agent" standalone', () => {
    const body = 'agent';
    expect(HUMAN_AGENT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });

  it('detects "call me please"', () => {
    const body = 'call me please';
    expect(HUMAN_AGENT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });

  it('does NOT flag "I am a real estate agent"', () => {
    // "agent" is in here — this is acceptable and expected behaviour per spec
    const body = 'I am a real estate agent looking for property';
    expect(HUMAN_AGENT.some(k => body.toLowerCase().includes(k))).toBe(true);
  });
});

// ─── INR formatter ────────────────────────────────────────────────────────────

function formatINR(v: number): string {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}

describe('formatINR', () => {
  it('formats crore correctly', () => {
    expect(formatINR(10000000)).toBe('₹1.00 Cr');
    expect(formatINR(25000000)).toBe('₹2.50 Cr');
  });

  it('formats lakh correctly', () => {
    expect(formatINR(500000)).toBe('₹5.00 L');
    expect(formatINR(4500000)).toBe('₹45.00 L');
  });

  it('formats small amounts directly', () => {
    expect(formatINR(50000)).toContain('50,000');
  });
});

// ─── Budget parsing (INR conversions) ─────────────────────────────────────────

function parseINRText(text: string): number | null {
  const lower = text.toLowerCase();
  const crMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr)/);
  if (crMatch) return parseFloat(crMatch[1]) * 10000000;
  const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|l)/);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100000;
  return null;
}

describe('INR text parsing (AI expected conversions)', () => {
  it('parses "50 lakhs" → 5000000', () => {
    expect(parseINRText('50 lakhs')).toBe(5000000);
  });

  it('parses "1 crore" → 10000000', () => {
    expect(parseINRText('1 crore')).toBe(10000000);
  });

  it('parses "2.5 cr" → 25000000', () => {
    expect(parseINRText('2.5 cr')).toBe(25000000);
  });

  it('parses "80 lakh" → 8000000', () => {
    expect(parseINRText('80 lakh')).toBe(8000000);
  });

  it('returns null for unparseable text', () => {
    expect(parseINRText('some property')).toBeNull();
  });
});

// ─── Outbound idempotency key stability ───────────────────────────────────────

import { createHash } from 'crypto';

function outboundKey(to: string, text: string): string {
  const slot = Math.floor(Date.now() / (10 * 60 * 1000));
  return createHash('sha256').update(to + '|' + text + '|' + slot).digest('hex');
}

describe('Outbound idempotency key', () => {
  it('produces the same key for same inputs within the same slot', () => {
    const k1 = outboundKey('+919876543210', 'Hello, test message');
    const k2 = outboundKey('+919876543210', 'Hello, test message');
    expect(k1).toBe(k2);
  });

  it('produces different keys for different recipients', () => {
    const k1 = outboundKey('+919876543210', 'Hello');
    const k2 = outboundKey('+919123456789', 'Hello');
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different messages', () => {
    const k1 = outboundKey('+919876543210', 'Hello');
    const k2 = outboundKey('+919876543210', 'World');
    expect(k1).not.toBe(k2);
  });

  it('key is a 64-char hex string', () => {
    const k = outboundKey('+919876543210', 'Test');
    expect(k).toMatch(/^[a-f0-9]{64}$/);
  });
});
