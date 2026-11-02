/**
 * Conversation Engine — stateful WhatsApp conversation orchestrator.
 * Uses Supabase PostgreSQL (via service role client) instead of Firestore.
 */
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';
import { getSupabase, writeAudit } from './supabaseAdmin';
import { downloadAndStoreMedia } from './mediaService';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ['house', 'flat', 'plot', 'commercial', 'villa', 'land'] as const;
const LAND_AREA_UNITS = ['cent', 'acre', 'sqft', 'sqm'] as const;
const INTENTS = ['buy', 'sell', 'rent', 'general_enquiry', 'greeting', 'opt_out', 'unknown'] as const;
const PURPOSES = ['buy', 'rent'] as const;
const LANGUAGES = ['en', 'ml', 'mixed'] as const;

const IntentSchema = z.enum(INTENTS);

const BuyerFieldsSchema = z.object({
  property_type: z.enum(PROPERTY_TYPES).nullable().optional(),
  purpose: z.enum(PURPOSES).nullable().optional(),
  locations: z.array(z.string()).nullable().optional(),
  budget_min: z.number().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  bedrooms_min: z.number().int().nullable().optional(),
  timeline: z.string().nullable().optional(),
  corrections: z.record(z.string(), z.unknown()).optional(),
});

const SellerFieldsSchema = z.object({
  property_type: z.enum(PROPERTY_TYPES).nullable().optional(),
  location: z.string().nullable().optional(),
  asking_price: z.number().nullable().optional(),
  land_area: z.number().nullable().optional(),
  land_area_unit: z.enum(LAND_AREA_UNITS).nullable().optional(),
  built_up_area: z.number().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  road_access: z.boolean().nullable().optional(),
  description: z.string().nullable().optional(),
});

const ExtractionResultSchema = z.object({
  intent: IntentSchema,
  language: z.enum(LANGUAGES).default('en'),
  buyer_fields: BuyerFieldsSchema.optional(),
  seller_fields: SellerFieldsSchema.optional(),
  missing_fields: z.array(z.string()).optional(),
  ai_reply: z.string(),
});

type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
type BuyerFields = z.infer<typeof BuyerFieldsSchema>;
type SellerFields = z.infer<typeof SellerFieldsSchema>;

// ─── Opt-out / opt-in / human-agent keywords ─────────────────────────────────

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'quit', 'optout', 'opt out', 'cancel',
  'നിർത്തുക', 'വേണ്ട'];

const OPT_IN_KEYWORDS = ['start', 'resume', 'subscribe', 'ആരംഭിക്കുക'];

const HUMAN_AGENT_KEYWORDS = ['human', 'agent', 'talk to agent', 'speak to agent',
  'talk to human', 'call me', 'real person', 'മനുഷ്യൻ', 'ഏജന്റ്'];

const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'hai', 'hii', 'helo', 'hiya',
  'help', 'menu', 'നമസ്കാരം', 'ഹലോ', 'ഹായ്', 'ഹേ'];

// ─── Gemini client ────────────────────────────────────────────────────────────

let genai: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genai) genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  return genai;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvState {
  id: string;
  customer_id: string;
  workflow_status: string;
  intent: string;
  automation_paused: boolean;
  opted_out: boolean;
  language: string;
  buyer_data?: Partial<BuyerFields>;
  seller_data?: Partial<SellerFields>;
  pending_submission_id?: string;
  last_message_at: string;
  created_at: string;
}

interface PropertyResult {
  id: string;
  title: string;
  price: number;
  location: string;
  url: string;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function db() { return getSupabase(); }

async function getOrCreateCustomer(phone: string, name?: string): Promise<string> {
  const { data: existing } = await db()
    .from('crm_customers')
    .select('id, name')
    .eq('phone_e164', phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (name && !existing.name) {
      await db().from('crm_customers')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing.id as string;
  }

  const { data: newCustomer, error } = await db()
    .from('crm_customers')
    .insert({
      phone_e164: phone,
      name: name ?? null,
      opted_out: false,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error('Failed to create customer: ' + error.message);
  return newCustomer.id as string;
}

async function getOrCreateConversation(customerId: string): Promise<ConvState> {
  const { data: existing } = await db()
    .from('crm_conversations')
    .select('*')
    .eq('customer_id', customerId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as ConvState;

  const now = new Date().toISOString();
  const { data: newConv, error } = await db()
    .from('crm_conversations')
    .insert({
      customer_id: customerId,
      workflow_status: 'new',
      intent: 'unknown',
      automation_paused: false,
      opted_out: false,
      language: 'en',
      buyer_data: null,
      seller_data: null,
      last_message_at: now,
      created_at: now,
    })
    .select('*')
    .single();

  if (error) throw new Error('Failed to create conversation: ' + error.message);
  return newConv as ConvState;
}

async function saveConversation(id: string, updates: Partial<ConvState>): Promise<void> {
  const { error } = await db()
    .from('crm_conversations')
    .update({ ...updates, last_message_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error('saveConversation failed: ' + error.message);
}

async function saveMessage(
  conversationId: string,
  customerId: string,
  direction: 'inbound' | 'outbound',
  body: string,
  providerId?: string,
  mediaId?: string,
  mimeType?: string
): Promise<void> {
  if (providerId) {
    const { data: existing } = await db()
      .from('crm_messages')
      .select('id')
      .eq('provider_message_id', providerId)
      .limit(1)
      .maybeSingle();
    if (existing) return;
  }

  const { error } = await db().from('crm_messages').insert({
    conversation_id: conversationId,
    customer_id: customerId,
    direction,
    message_type: mediaId ? 'image' : 'text',
    body: body || null,
    provider_message_id: providerId ?? null,
    media_id: mediaId ?? null,
    media_mime_type: mimeType ?? null,
    provider_status: direction === 'outbound' ? 'sent' : 'received',
    created_at: new Date().toISOString(),
  });
  if (error && !error.message.includes('unique constraint')) {
    console.error('[saveMessage] error:', error.message);
  }
}

// ─── Property search ──────────────────────────────────────────────────────────

async function searchProperties(fields: Partial<BuyerFields>): Promise<PropertyResult[]> {
  let query = db()
    .from('properties')
    .select('id, title, price, location, district, property_type, bedrooms')
    .in('status', ['active', 'available']);

  if (fields.property_type) {
    query = query.eq('property_type', fields.property_type);
  }
  if (fields.budget_max) {
    query = query.lte('price', fields.budget_max);
  }

  query = query.limit(20);

  const { data: results, error } = await query;
  if (error) { console.error('[searchProperties]', error.message); return []; }

  let filtered = results ?? [];

  if (fields.locations && fields.locations.length > 0) {
    const locs = fields.locations.map(l => l.toLowerCase());
    filtered = filtered.filter(p => {
      const loc = String(p.location ?? p.district ?? '').toLowerCase();
      return locs.some(l => loc.includes(l));
    });
  }

  if (fields.budget_min) {
    filtered = filtered.filter(p => Number(p.price) >= (fields.budget_min as number));
  }

  if (fields.bedrooms_min) {
    filtered = filtered.filter(p => Number(p.bedrooms) >= (fields.bedrooms_min as number));
  }

  const baseUrl = process.env.WEBSITE_BASE_URL || 'https://snhomes.in';
  return filtered.slice(0, 5).map(p => ({
    id: p.id as string,
    title: String(p.title ?? 'Property'),
    price: Number(p.price),
    location: String(p.location ?? p.district ?? ''),
    url: `${baseUrl}/property/${p.id}`,
  }));
}

// ─── Outbound idempotency ─────────────────────────────────────────────────────

function outboundKey(to: string, text: string): string {
  const slot = Math.floor(Date.now() / (30 * 1000));
  return createHash('sha256').update(to + '|' + text + '|' + slot).digest('hex');
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) {
    console.warn('[WA] Missing credentials, skipping send to', to);
    return null;
  }

  const idemKey = outboundKey(to, text);
  const now = new Date().toISOString();

  // Check idempotency — filter out expired records
  const { data: existing } = await db()
    .from('crm_outbound_idempotency')
    .select('wamid')
    .eq('id', idemKey)
    .gt('expires_at', now)
    .maybeSingle();

  if (existing) {
    console.log('[WA] Duplicate suppressed (idempotency key hit):', idemKey.slice(0, 12));
    return (existing.wamid as string) ?? null;
  }

  const res = await fetch(
    'https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    console.error('[WA send error]', await res.text());
    return null;
  }

  const data = await res.json() as { messages?: Array<{ id?: string }> };
  const wamid = data.messages?.[0]?.id ?? null;

  // Upsert idempotency record (1h TTL)
  await db().from('crm_outbound_idempotency').upsert({
    id: idemKey,
    wamid,
    to_phone: to,
    created_at: now,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  return wamid;
}

// ─── Interactive button message ───────────────────────────────────────────────

export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return null;

  const res = await fetch(
    'https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }),
    }
  );

  if (!res.ok) {
    console.error('[WA interactive error]', await res.text());
    return null;
  }

  const data = await res.json() as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

const INTENT_BUTTONS = [
  { id: 'buy',  title: '🏠 Buy Property'  },
  { id: 'sell', title: '🏷️ Sell Property' },
  { id: 'rent', title: '🔑 Rent Property' },
];

async function sendWelcomeMenu(
  to: string,
  convId: string,
  customerId: string,
  isMl: boolean,
): Promise<void> {
  const bodyText = isMl
    ? 'S N Homes-ലേക്ക് സ്വാഗതം! 🏡\n\nനിങ്ങൾ ഇന്ന് എന്ത് ചെയ്യാൻ ആഗ്രഹിക്കുന്നു?'
    : 'Welcome to *S N Homes*! 🏡\n\nWhat are you planning to do today?';
  const wamid = await sendInteractiveButtons(to, bodyText, INTENT_BUTTONS);
  await saveMessage(convId, customerId, 'outbound', bodyText, wamid ?? undefined);
}

// ─── Owner notification ───────────────────────────────────────────────────────

async function notifyOwner(subject: string, body: string): Promise<void> {
  await db().from('crm_notifications').insert({
    subject,
    body,
    read: false,
    created_at: new Date().toISOString(),
  });

  const ownerPhone = process.env.OWNER_WHATSAPP_PHONE;
  if (ownerPhone) {
    await sendWhatsAppMessage(ownerPhone, `*${subject}*\n\n${body}`).catch(() => null);
  }

  const sgKey = process.env.SENDGRID_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  if (sgKey && ownerEmail) {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sgKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ownerEmail }] }],
        from: { email: 'noreply@snhomes.in', name: 'S&N Homes CRM' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    }).catch(() => null);
  }
}

// ─── Gemini AI extraction ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the AI assistant for S&N Homes, a real estate agency in Kerala, India.
You support English and Malayalam. Extract structured data and return ONLY valid JSON:
{
  "intent": "buy"|"sell"|"rent"|"general_enquiry"|"greeting"|"opt_out"|"unknown",
  "language": "en"|"ml"|"mixed",
  "buyer_fields": {
    "property_type": "house"|"flat"|"plot"|"commercial"|"villa"|"land"|null,
    "purpose": "buy"|"rent"|null,
    "locations": ["string"]|null,
    "budget_min": number|null,
    "budget_max": number|null,
    "bedrooms_min": number|null,
    "timeline": "string"|null,
    "corrections": {}
  }|null,
  "seller_fields": {
    "property_type": string|null, "location": string|null,
    "asking_price": number|null, "land_area": number|null,
    "land_area_unit": "cent"|"acre"|"sqft"|"sqm"|null,
    "built_up_area": number|null, "bedrooms": number|null,
    "bathrooms": number|null, "road_access": boolean|null,
    "description": string|null
  }|null,
  "missing_fields": ["string"],
  "ai_reply": "Reply in the user's language, max 3 sentences"
}
Rules: INR amounts — convert "50 lakhs"=5000000, "1 crore"=10000000.
Return ONLY the JSON object, no markdown.`;

async function extractWithGemini(
  conv: ConvState,
  userMessage: string,
  history: string
): Promise<ExtractionResult | null> {
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ]));

  const ctx = JSON.stringify({
    current_intent: conv.intent,
    workflow_status: conv.workflow_status,
    buyer_data_so_far: conv.buyer_data ?? null,
    seller_data_so_far: conv.seller_data ?? null,
  });

  const prompt = [
    SYSTEM_PROMPT,
    `\nContext: ${ctx}`,
    history ? `\nHistory:\n${history}` : '',
    `\nMessage: "${userMessage}"\n\nJSON:`,
  ].join('');

  const genAI = getGenAI();

  for (const m of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      return ExtractionResultSchema.parse(JSON.parse(raw));
    } catch (err) {
      console.warn(`[Gemini] Model ${m} error:`, (err as Error).message);
    }
  }

  console.error('[Gemini error] All candidate models failed');
  return null;
}

// ─── Format INR ───────────────────────────────────────────────────────────────

function formatINR(amount?: number | null): string {
  if (!amount) return '—';
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(1) + ' Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + ' L';
  return '₹' + amount.toLocaleString('en-IN');
}

// ─── Conversation history ─────────────────────────────────────────────────────

async function getRecentHistory(conversationId: string): Promise<string> {
  const { data: messages } = await db()
    .from('crm_messages')
    .select('direction, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (!messages) return '';
  return messages.reverse().map(m =>
    `${m.direction === 'inbound' ? 'User' : 'Bot'}: ${m.body ?? '[media]'}`
  ).join('\n');
}

// ─── Record property matches ──────────────────────────────────────────────────

async function recordMatches(conversationId: string, properties: PropertyResult[]): Promise<void> {
  if (properties.length === 0) return;
  const records = properties.map(p => ({
    conversation_id: conversationId,
    property_id: p.id,
    property_title: p.title,
    property_url: p.url,
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }));
  const { error } = await db().from('crm_property_matches').insert(records);
  if (error) console.error('[recordMatches]', error.message);
}

// ─── Buyer workflow ───────────────────────────────────────────────────────────

async function handleBuyerFlow(conv: ConvState, extraction: ExtractionResult): Promise<string> {
  const merged: Partial<BuyerFields> = {
    ...(conv.buyer_data ?? {}),
    ...(extraction.buyer_fields?.corrections ?? {}),
    ...Object.fromEntries(
      Object.entries(extraction.buyer_fields ?? {}).filter(
        ([k, v]) => k !== 'corrections' && v !== null && v !== undefined
      )
    ),
  };

  await saveConversation(conv.id, {
    intent: 'buy',
    buyer_data: merged,
    workflow_status: 'requirements_collecting',
    language: extraction.language,
  });

  const needed: string[] = [];
  if (!merged.property_type) needed.push('property_type');
  if (!merged.locations?.length) needed.push('location');
  if (!merged.budget_max) needed.push('budget');

  if (needed.length > 0) return extraction.ai_reply;

  // All required fields collected — save buyer request
  await db().from('crm_buyer_requests').insert({
    customer_id: conv.customer_id,
    conversation_id: conv.id,
    requirements: {
      property_type: merged.property_type ?? null,
      purpose: merged.purpose ?? 'buy',
      locations: merged.locations ?? [],
      budget_min: merged.budget_min ?? null,
      budget_max: merged.budget_max ?? null,
      bedrooms_min: merged.bedrooms_min ?? null,
      timeline: merged.timeline ?? null,
    },
    status: 'new',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await saveConversation(conv.id, { workflow_status: 'matching' });
  const matches = await searchProperties(merged);
  const isMl = extraction.language === 'ml';

  let reply: string;
  if (matches.length === 0) {
    const relaxed = await searchProperties({ ...merged, bedrooms_min: undefined });
    if (relaxed.length === 0) {
      reply = isMl
        ? 'ക്ഷമിക്കുക, ഇപ്പോൾ അനുയോജ്യമായ properties ഇല്ല. ഞങ്ങൾ ഉടനെ ബന്ധപ്പെടും.'
        : "Sorry, no properties match your requirements right now. We'll contact you when one becomes available.";
      await saveConversation(conv.id, { workflow_status: 'no_match' });
    } else {
      reply = (isMl ? 'Exact match ഇല്ല, ഇവ ഉപകാരപ്പെടാം:\n\n' : 'No exact match, but these may interest you:\n\n') +
        relaxed.map((p, i) => `${i + 1}. ${p.title}\n   ${p.location} — ${formatINR(p.price)}\n   ${p.url}`).join('\n\n');
      await recordMatches(conv.id, relaxed);
    }
  } else {
    reply = (isMl ? 'നിങ്ങൾക്ക് അനുയോജ്യമായ properties:\n\n' : 'Properties matching your requirements:\n\n') +
      matches.map((p, i) => `${i + 1}. ${p.title}\n   ${p.location} — ${formatINR(p.price)}\n   ${p.url}`).join('\n\n') +
      (isMl
        ? '\n\nഇതിൽ ഒന്ന് visit ചെയ്യണോ?\n1 - Site visit schedule ചെയ്യൂ\n2 - Callback ആവശ്യമുണ്ട്\n3 - ഇപ്പോൾ വേണ്ട'
        : '\n\nWould you like to:\n1 - Schedule a site visit\n2 - Request a callback\n3 - Not now');
    await recordMatches(conv.id, matches);
    await saveConversation(conv.id, { workflow_status: 'matches_sent' });

    const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db().from('crm_follow_up_tasks').insert({
      customer_id: conv.customer_id,
      conversation_id: conv.id,
      task_type: 'follow_up',
      status: 'pending',
      due_at: due,
      notes: 'Buyer received matches — confirm visit/callback interest',
      created_at: new Date().toISOString(),
    });
  }
  return reply;
}

// ─── Seller workflow ──────────────────────────────────────────────────────────

async function handleSellerFlow(
  conv: ConvState,
  extraction: ExtractionResult,
  mediaId?: string,
): Promise<string> {
  const merged: Partial<SellerFields> = {
    ...(conv.seller_data ?? {}),
    ...Object.fromEntries(
      Object.entries(extraction.seller_fields ?? {}).filter(([, v]) => v !== null && v !== undefined)
    ),
  };

  const isMl = conv.language === 'ml' || extraction.language === 'ml';

  // Handle photo upload
  if (mediaId && conv.pending_submission_id) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
    try {
      const { storagePath } = await downloadAndStoreMedia(mediaId, conv.pending_submission_id, token);

      // Append path to image_paths array
      const { data: sub } = await db()
        .from('crm_seller_submissions')
        .select('image_paths')
        .eq('id', conv.pending_submission_id)
        .single();

      const currentPaths: string[] = (sub?.image_paths as string[]) ?? [];
      const newPaths = [...currentPaths, storagePath];
      await db()
        .from('crm_seller_submissions')
        .update({ image_paths: newPaths, updated_at: new Date().toISOString() })
        .eq('id', conv.pending_submission_id);

      const imageCount = newPaths.length;
      if (imageCount < 3) {
        return isMl
          ? `Photo ${imageCount} ലഭിച്ചു. ${3 - imageCount} കൂടി share ചെയ്യൂ (അല്ലെങ്കിൽ "done" type ചെയ്യൂ).`
          : `Photo ${imageCount} received. Share ${3 - imageCount} more (or type "done" to finish).`;
      }
      return isMl
        ? 'Photos ലഭിച്ചു! Submission complete. ഞങ്ങൾ review ചെയ്ത് inform ചെയ്യാം.'
        : "All photos received! We'll review and get back to you shortly.";
    } catch (err) {
      console.error('[Media upload error]', err);
      return 'Sorry, error uploading your photo. Please try again.';
    }
  }

  await saveConversation(conv.id, {
    intent: 'sell',
    seller_data: merged,
    workflow_status: 'seller_collecting',
    language: extraction.language,
  });

  const needed: string[] = [];
  if (!merged.property_type) needed.push('property_type');
  if (!merged.location) needed.push('location');
  if (!merged.asking_price) needed.push('asking_price');

  if (needed.length > 0) return extraction.ai_reply;

  // Create submission if not yet created
  let submissionId = conv.pending_submission_id;
  if (!submissionId) {
    const { data: subDoc, error } = await db()
      .from('crm_seller_submissions')
      .insert({
        customer_id: conv.customer_id,
        conversation_id: conv.id,
        details: {
          property_type: merged.property_type ?? null,
          location: merged.location ?? null,
          asking_price: merged.asking_price ?? null,
          land_area: merged.land_area ?? null,
          land_area_unit: merged.land_area_unit ?? 'cent',
          built_up_area: merged.built_up_area ?? null,
          bedrooms: merged.bedrooms ?? null,
          bathrooms: merged.bathrooms ?? null,
          road_access: merged.road_access ?? null,
          description: merged.description ?? null,
        },
        image_paths: [],
        approval_status: 'incomplete',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw new Error('Failed to create seller submission: ' + error.message);
    submissionId = subDoc.id as string;
    await saveConversation(conv.id, {
      pending_submission_id: submissionId,
      workflow_status: 'seller_photos',
    });
    await writeAudit('submission_created', 'crm_seller_submissions', submissionId, conv.customer_id);
  }

  if (conv.workflow_status !== 'seller_photos') {
    return isMl
      ? 'Details ലഭിച്ചു! Property photos share ചെയ്യൂ (min 1, max 10). Photos ഇല്ലെങ്കിൽ "no photos" type ചെയ്യൂ.'
      : "Details received! Please share photos (min 1, max 10). Type \"no photos\" if you don't have any.";
  }

  // Mark submission pending review
  await db()
    .from('crm_seller_submissions')
    .update({ approval_status: 'pending_review', updated_at: new Date().toISOString() })
    .eq('id', submissionId);

  await saveConversation(conv.id, { workflow_status: 'seller_submitted' });

  await notifyOwner(
    'New Seller Submission',
    `Property: ${merged.property_type} in ${merged.location} @ ${formatINR(merged.asking_price)}\n` +
    `Review: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/sellers`
  );

  return isMl
    ? 'Submission ലഭിച്ചു! 24 hrs-ൽ ഞങ്ങൾ WhatsApp-ൽ inform ചെയ്യാം. നന്ദി!'
    : 'Submission received! Our team will review and WhatsApp you within 24 hours. Thank you!';
}

// ─── Opt-out / opt-in ─────────────────────────────────────────────────────────

async function handleOptOut(customerId: string, convId: string, phone: string): Promise<string> {
  await db().from('crm_customers').update({ opted_out: true }).eq('id', customerId);
  await saveConversation(convId, { opted_out: true, automation_paused: true });
  await writeAudit('opt_out', 'crm_customers', customerId, phone);
  return 'You have been unsubscribed from S&N Homes messages. Reply START to re-subscribe.';
}

async function handleOptIn(customerId: string, convId: string): Promise<string> {
  await db().from('crm_customers').update({ opted_out: false }).eq('id', customerId);
  await saveConversation(convId, { opted_out: false, automation_paused: false });
  return 'Welcome back! You are subscribed to S&N Homes updates. How can I help you?';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface InboundMessage {
  from: string;
  senderName?: string;
  body: string;
  providerId: string;
  mediaId?: string;
  mimeType?: string;
}

export async function processMessage(msg: InboundMessage): Promise<void> {
  const { from, senderName, body, providerId, mediaId } = msg;
  const bodyLower = body.toLowerCase().trim();

  // Deduplication — check crm_webhook_events
  const { data: dup } = await db()
    .from('crm_webhook_events')
    .select('id')
    .eq('provider_message_id', providerId)
    .limit(1)
    .maybeSingle();

  if (dup) {
    console.log('[Engine] Duplicate skipped:', providerId);
    return;
  }

  await db().from('crm_webhook_events').insert({
    provider_message_id: providerId,
    from_phone: from,
    body: body || null,
    media_id: mediaId ?? null,
    processed_at: new Date().toISOString(),
  });

  const customerId = await getOrCreateCustomer(from, senderName);
  const conv = await getOrCreateConversation(customerId);

  await saveMessage(conv.id, customerId, 'inbound', body, providerId, mediaId, msg.mimeType);

  // Paused check
  if (conv.automation_paused
    && !OPT_IN_KEYWORDS.some(k => bodyLower === k)
    && !OPT_OUT_KEYWORDS.some(k => bodyLower.includes(k))) {
    console.log('[Engine] Paused — skipping automation');
    return;
  }

  // Opt-in
  if (OPT_IN_KEYWORDS.some(k => bodyLower === k) && conv.opted_out) {
    const reply = await handleOptIn(customerId, conv.id);
    const wamid = await sendWhatsAppMessage(from, reply);
    await saveMessage(conv.id, customerId, 'outbound', reply, wamid ?? undefined);
    return;
  }

  // Opt-out
  if (OPT_OUT_KEYWORDS.some(k => bodyLower.includes(k))) {
    const reply = await handleOptOut(customerId, conv.id, from);
    const wamid = await sendWhatsAppMessage(from, reply);
    await saveMessage(conv.id, customerId, 'outbound', reply, wamid ?? undefined);
    return;
  }

  if (conv.opted_out) {
    await sendWhatsAppMessage(from, 'You are unsubscribed. Reply START to re-subscribe.');
    return;
  }

  // Human agent request
  if (HUMAN_AGENT_KEYWORDS.some(k => bodyLower.includes(k))) {
    await saveConversation(conv.id, { automation_paused: true });
    const ack = conv.language === 'ml'
      ? 'ഞങ്ങളുടെ team member ഉടനെ ബന്ധപ്പെടും. Bot responses pause ചെയ്തിട്ടുണ്ട്.'
      : 'A team member will contact you shortly. Automated replies have been paused.';
    const wamidAck = await sendWhatsAppMessage(from, ack);
    await saveMessage(conv.id, customerId, 'outbound', ack, wamidAck ?? undefined);
    await notifyOwner(
      'Customer Requested Human Agent',
      'Customer ' + from + ' has requested to speak with a human agent.\n' +
      'Conversation paused. Reply via the Inbox: ' + (process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in') + '/admin/crm/inbox'
    );
    return;
  }

  // ── Greeting → send welcome menu with Buy / Sell / Rent buttons ────────────
  if (GREETING_KEYWORDS.some(k => bodyLower === k)) {
    await saveConversation(conv.id, { workflow_status: 'awaiting_intent' });
    await sendWelcomeMenu(from, conv.id, customerId, conv.language === 'ml');
    return;
  }

  // ── Intent buttons (Buy / Sell / Rent) from welcome menu ──────────────────
  const isBuy = ['buy', '🏠 buy property', 'buy property'].includes(bodyLower);
  const isSell = ['sell', '🏷️ sell property', 'sell property'].includes(bodyLower);
  const isRent = ['rent', '🔑 rent property', 'rent property'].includes(bodyLower);

  if (isBuy || isRent) {
    const isMl = conv.language === 'ml';
    await saveConversation(conv.id, {
      intent: isBuy ? 'buy' : 'rent',
      workflow_status: 'requirements_collecting',
    });
    const reply = isMl
      ? 'തീർച്ചയായും! നിങ്ങൾ ഏത് തരത്തിലുള്ള property ആണ് അന്വേഷിക്കുന്നത്? (House, Flat/Apartment, Villa, Plot)\n\nസ്ഥലവും ബഡ്ജറ്റും share ചെയ്യൂ (ഉദാ: *2BHK flat in Pala under 50 Lakhs*).'
      : 'Great! What kind of property are you looking for? (House, Flat/Apartment, Villa, or Plot)\n\nPlease share your preferred location and budget (e.g., *2BHK house in Pala under 60 Lakhs*).';
    const wamid = await sendWhatsAppMessage(from, reply);
    await saveMessage(conv.id, customerId, 'outbound', reply, wamid ?? undefined);
    return;
  }

  if (isSell) {
    const isMl = conv.language === 'ml';
    await saveConversation(conv.id, {
      intent: 'sell',
      workflow_status: 'seller_collecting',
    });
    const reply = isMl
      ? 'നിങ്ങളുടെ property sell ചെയ്യാൻ സഹായിക്കാം! 🏡\n\nProperty type (House/Flat/Land), സ്ഥലം, പ്രതീക്ഷിക്കുന്ന വില (asking price) എന്നിവ share ചെയ്യൂ (ഉദാ: *3BHK house in Pala, asking 75 Lakhs*).'
      : 'We would love to help you find buyers for your property! 🏡\n\nPlease share the property type (House/Flat/Land), location, and your asking price (e.g., *3BHK house in Pala, asking 75 Lakhs*).';
    const wamid = await sendWhatsAppMessage(from, reply);
    await saveMessage(conv.id, customerId, 'outbound', reply, wamid ?? undefined);
    return;
  }

  const history = await getRecentHistory(conv.id);
  const extraction = await extractWithGemini(conv, body, history);

  if (!extraction) {
    const fallback = "Sorry, I couldn't understand that. Please try again or type \"help\".";
    const wamid = await sendWhatsAppMessage(from, fallback);
    await saveMessage(conv.id, customerId, 'outbound', fallback, wamid ?? undefined);
    return;
  }

  let replyText = extraction.ai_reply;

  if (extraction.intent === 'opt_out') {
    replyText = await handleOptOut(customerId, conv.id, from);
  } else if (
    extraction.intent === 'buy' || extraction.intent === 'rent' ||
    (conv.intent === 'buy' && !['seller_collecting', 'seller_photos', 'seller_submitted'].includes(conv.workflow_status))
  ) {
    replyText = await handleBuyerFlow(conv, extraction);
  } else if (
    extraction.intent === 'sell' ||
    ['seller_collecting', 'seller_photos'].includes(conv.workflow_status)
  ) {
    replyText = await handleSellerFlow(conv, extraction, mediaId);
  } else {
    await saveConversation(conv.id, { language: extraction.language });
  }

  const wamid = await sendWhatsAppMessage(from, replyText);
  await saveMessage(conv.id, customerId, 'outbound', replyText, wamid ?? undefined);
}
