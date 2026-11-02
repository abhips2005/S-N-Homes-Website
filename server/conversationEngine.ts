/**
 * Conversation Engine — stateful WhatsApp conversation orchestrator.
 * Pure state-machine, NO AI/Gemini dependency.
 * Uses Supabase PostgreSQL (via service role client).
 */
import { createHash } from 'crypto';
import { getSupabase, writeAudit } from './supabaseAdmin';
import { downloadAndStoreMedia } from './mediaService';

// ─── Kerala districts ─────────────────────────────────────────────────────────

const KERALA_DISTRICTS = [
  'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod',
  'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad',
  'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad',
];

// ─── Keywords ─────────────────────────────────────────────────────────────────

const OPT_OUT_KEYWORDS  = ['stop', 'unsubscribe', 'quit', 'optout', 'opt out', 'cancel', 'നിർത്തുക', 'വേണ്ട'];
const OPT_IN_KEYWORDS   = ['start', 'resume', 'subscribe', 'ആരംഭിക്കുക'];
const HUMAN_AGENT_KEYWORDS = ['human', 'agent', 'talk to agent', 'speak to agent',
  'talk to human', 'call me', 'real person', 'മനുഷ്യൻ', 'ഏജന്റ്'];
const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'hai', 'hii', 'helo', 'hiya',
  'help', 'menu', 'start over', 'restart', 'നമസ്കാരം', 'ഹലോ', 'ഹായ്', 'ഹേ'];

// ─── Conversation data type ───────────────────────────────────────────────────

interface ConvData {
  intent?: string;
  property_type?: string;
  district?: string;
  location?: string;
  detail?: string;
  budget?: string;
  asking_price?: number;
  image_count?: number;
}

interface ConvState {
  id: string;
  customer_id: string;
  workflow_status: string;
  intent: string;
  automation_paused: boolean;
  opted_out: boolean;
  language: string;
  buyer_data?: Partial<ConvData> | null;
  seller_data?: Partial<ConvData> | null;
  pending_submission_id?: string | null;
  last_message_at: string;
  created_at: string;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function db() { return getSupabase(); }

async function getOrCreateCustomer(phone: string, name?: string): Promise<string> {
  const { data: existing } = await db()
    .from('crm_customers').select('id, name').eq('phone_e164', phone).limit(1).maybeSingle();
  if (existing) {
    if (name && !existing.name)
      await db().from('crm_customers').update({ name, updated_at: new Date().toISOString() }).eq('id', existing.id);
    return existing.id as string;
  }
  const { data: newCustomer, error } = await db()
    .from('crm_customers')
    .insert({ phone_e164: phone, name: name ?? null, opted_out: false, created_at: new Date().toISOString() })
    .select('id').single();
  if (error) throw new Error('Failed to create customer: ' + error.message);
  return newCustomer.id as string;
}

async function getOrCreateConversation(customerId: string): Promise<ConvState> {
  const { data: existing } = await db()
    .from('crm_conversations').select('*').eq('customer_id', customerId)
    .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing as ConvState;
  const now = new Date().toISOString();
  const { data: newConv, error } = await db()
    .from('crm_conversations')
    .insert({ customer_id: customerId, workflow_status: 'new', intent: 'unknown',
      automation_paused: false, opted_out: false, language: 'en',
      buyer_data: null, seller_data: null, last_message_at: now, created_at: now })
    .select('*').single();
  if (error) throw new Error('Failed to create conversation: ' + error.message);
  return newConv as ConvState;
}

async function saveConversation(id: string, updates: Partial<ConvState>): Promise<void> {
  const { error } = await db().from('crm_conversations')
    .update({ ...updates, last_message_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('saveConversation failed: ' + error.message);
}

async function saveMessage(
  conversationId: string, customerId: string,
  direction: 'inbound' | 'outbound', body: string,
  providerId?: string, mediaId?: string, mimeType?: string
): Promise<void> {
  if (providerId) {
    const { data: existing } = await db().from('crm_messages').select('id')
      .eq('provider_message_id', providerId).limit(1).maybeSingle();
    if (existing) return;
  }
  const { error } = await db().from('crm_messages').insert({
    conversation_id: conversationId, customer_id: customerId, direction,
    message_type: mediaId ? 'image' : 'text', body: body || null,
    provider_message_id: providerId ?? null, media_id: mediaId ?? null,
    media_mime_type: mimeType ?? null,
    provider_status: direction === 'outbound' ? 'sent' : 'received',
    created_at: new Date().toISOString(),
  });
  if (error && !error.message.includes('unique constraint'))
    console.error('[saveMessage] error:', error.message);
}

// ─── Outbound idempotency ─────────────────────────────────────────────────────

function outboundKey(to: string, text: string): string {
  const slot = Math.floor(Date.now() / (30 * 1000));
  return createHash('sha256').update(to + '|' + text + '|' + slot).digest('hex');
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) { console.warn('[WA] Missing credentials'); return null; }

  const idemKey = outboundKey(to, text);
  const now = new Date().toISOString();
  const { data: existing } = await db().from('crm_outbound_idempotency').select('wamid')
    .eq('id', idemKey).gt('expires_at', now).maybeSingle();
  if (existing) { console.log('[WA] Duplicate suppressed'); return (existing.wamid as string) ?? null; }

  const res = await fetch('https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  if (!res.ok) { console.error('[WA send error]', await res.text()); return null; }

  const data = await res.json() as { messages?: Array<{ id?: string }> };
  const wamid = data.messages?.[0]?.id ?? null;
  await db().from('crm_outbound_idempotency').upsert({
    id: idemKey, wamid, to_phone: to, created_at: now,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return wamid;
}

// ─── Interactive button message (max 3 buttons) ───────────────────────────────

export async function sendInteractiveButtons(
  to: string, bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return null;

  const res = await fetch('https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
      interactive: {
        type: 'button', body: { text: bodyText },
        action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    }),
  });
  if (!res.ok) { console.error('[WA interactive error]', await res.text()); return null; }
  const data = await res.json() as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

// ─── Interactive list message ─────────────────────────────────────────────────

interface ListItem { id: string; title: string; description?: string }
interface ListSection { title: string; rows: ListItem[] }

async function sendInteractiveList(
  to: string, headerText: string, bodyText: string,
  buttonLabel: string, sections: ListSection[],
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return null;

  const res = await fetch('https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        action: { button: buttonLabel, sections },
      },
    }),
  });
  if (!res.ok) { console.error('[WA list error]', await res.text()); return null; }
  const data = await res.json() as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

// ─── Owner notification ───────────────────────────────────────────────────────

async function notifyOwner(subject: string, body: string): Promise<void> {
  await db().from('crm_notifications').insert({ subject, body, read: false, created_at: new Date().toISOString() });
  const ownerPhone = process.env.OWNER_WHATSAPP_PHONE;
  if (ownerPhone) await sendWhatsAppMessage(ownerPhone, `*${subject}*\n\n${body}`).catch(() => null);
  const sgKey = process.env.SENDGRID_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  if (sgKey && ownerEmail) {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sgKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ownerEmail }] }],
        from: { email: 'noreply@snhomes.in', name: 'S&N Homes CRM' },
        subject, content: [{ type: 'text/plain', value: body }],
      }),
    }).catch(() => null);
  }
}

// ─── Opt-out / Opt-in ─────────────────────────────────────────────────────────

async function handleOptOut(customerId: string, convId: string, phone: string): Promise<string> {
  await db().from('crm_customers').update({ opted_out: true }).eq('id', customerId);
  await saveConversation(convId, { opted_out: true, automation_paused: true });
  await writeAudit('opt_out', 'crm_customers', customerId, phone);
  return 'You have been unsubscribed from S&N Homes messages. Reply START to re-subscribe.';
}

async function handleOptIn(customerId: string, convId: string): Promise<string> {
  await db().from('crm_customers').update({ opted_out: false }).eq('id', customerId);
  await saveConversation(convId, { opted_out: false, automation_paused: false });
  return 'Welcome back! You are subscribed to S&N Homes updates. Say *Hi* to get the main menu.';
}

// ─── Format INR ───────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(1) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

// ─── Budget helpers ───────────────────────────────────────────────────────────

function budgetToNumber(label: string): number {
  const m: Record<string, number> = {
    upto_25l: 2500000, upto_50l: 5000000, upto_75l: 7500000,
    upto_1cr: 10000000, above_1cr: 20000000,
    rent_15k: 15000, rent_25k: 25000, rent_50k: 50000,
  };
  return m[label] ?? 0;
}

function budgetLabel(label: string): string {
  const m: Record<string, string> = {
    upto_25l: 'Up to ₹25 Lakh', upto_50l: 'Up to ₹50 Lakh', upto_75l: 'Up to ₹75 Lakh',
    upto_1cr: 'Up to ₹1 Crore', above_1cr: 'More than ₹1 Crore',
    rent_15k: 'Up to ₹15,000/mo', rent_25k: 'Up to ₹25,000/mo', rent_50k: 'Up to ₹50,000/mo',
  };
  return m[label] ?? label;
}

// ─── Welcome menu ─────────────────────────────────────────────────────────────

async function sendWelcomeMenu(to: string, convId: string, customerId: string): Promise<void> {
  await saveConversation(convId, {
    workflow_status: 'awaiting_intent', intent: 'unknown',
    buyer_data: null, seller_data: null, pending_submission_id: null,
  });
  const text = 'Welcome to *S N Homes* 🏡\n\nWhat are you planning to do today?';
  const wamid = await sendInteractiveButtons(to, text, [
    { id: 'intent:buy',  title: '🏠 Buy Property' },
    { id: 'intent:sell', title: '🏷️ Sell Property' },
    { id: 'intent:rent', title: '🔑 Rent Property' },
  ]);
  await saveMessage(convId, customerId, 'outbound', text, wamid ?? undefined);
}

// ─── District list sender ─────────────────────────────────────────────────────

async function sendDistrictList(
  to: string, convId: string, customerId: string,
  prefix: string, question: string,
): Promise<void> {
  const half = Math.ceil(KERALA_DISTRICTS.length / 2);
  const sections: ListSection[] = [
    {
      title: 'South & Central Kerala',
      rows: KERALA_DISTRICTS.slice(0, half).map(d => ({ id: `${prefix}:district:${d}`, title: d })),
    },
    {
      title: 'North Kerala',
      rows: KERALA_DISTRICTS.slice(half).map(d => ({ id: `${prefix}:district:${d}`, title: d })),
    },
  ];
  const wamid = await sendInteractiveList(to, 'Select District', question, 'Choose District', sections);
  await saveMessage(convId, customerId, 'outbound', question, wamid ?? undefined);
}

// ─── Step question helpers ────────────────────────────────────────────────────

async function sendMsg(to: string, convId: string, customerId: string, text: string): Promise<void> {
  const wamid = await sendWhatsAppMessage(to, text);
  await saveMessage(convId, customerId, 'outbound', text, wamid ?? undefined);
}

async function sendBtns(
  to: string, convId: string, customerId: string,
  text: string, buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  const wamid = await sendInteractiveButtons(to, text, buttons);
  await saveMessage(convId, customerId, 'outbound', text, wamid ?? undefined);
}

async function askBuyerType(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(to, convId, customerId, 'What type of property are you looking for?', [
    { id: 'b:type:house',      title: '🏡 House' },
    { id: 'b:type:plot',       title: '🌿 Plot / Land' },
    { id: 'b:type:commercial', title: '🏢 Commercial' },
  ]);
}

async function askRentType(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(to, convId, customerId, 'What type of property are you looking to rent?', [
    { id: 'r:type:house',      title: '🏡 House' },
    { id: 'r:type:commercial', title: '🏢 Commercial' },
  ]);
}

async function askSellerType(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(to, convId, customerId, 'What type of property are you selling?', [
    { id: 's:type:house',      title: '🏡 House' },
    { id: 's:type:plot',       title: '🌿 Plot / Land' },
    { id: 's:type:commercial', title: '🏢 Commercial' },
  ]);
}

async function askBuyerDetail(
  to: string, convId: string, customerId: string,
  ptype: string, prefix: 'b' | 'r',
): Promise<void> {
  if (ptype === 'house') {
    await sendBtns(to, convId, customerId, 'How many bedrooms do you prefer?', [
      { id: `${prefix}:detail:2plus`, title: '2+ Bedrooms' },
      { id: `${prefix}:detail:3plus`, title: '3+ Bedrooms' },
      { id: `${prefix}:detail:4plus`, title: '4+ Bedrooms' },
    ]);
  } else if (ptype === 'plot') {
    await sendBtns(to, convId, customerId, 'What plot area are you looking for?', [
      { id: `${prefix}:detail:50cent`, title: 'Up to 50 Cent'     },
      { id: `${prefix}:detail:1acre`,  title: 'Up to 1 Acre'      },
      { id: `${prefix}:detail:big`,    title: 'More than 1 Acre'  },
    ]);
  } else {
    await sendBtns(to, convId, customerId, 'How many rooms do you need?', [
      { id: `${prefix}:detail:5rooms`,  title: 'Up to 5 Rooms'  },
      { id: `${prefix}:detail:10rooms`, title: 'Up to 10 Rooms' },
      { id: `${prefix}:detail:big`,     title: 'More than 10'   },
    ]);
  }
}

async function askSellerDetail(to: string, convId: string, customerId: string, ptype: string): Promise<void> {
  if (ptype === 'plot') {
    await sendBtns(to, convId, customerId, 'What is the plot area?', [
      { id: 's:detail:50cent', title: 'Up to 50 Cent'    },
      { id: 's:detail:1acre',  title: 'Up to 1 Acre'     },
      { id: 's:detail:big',    title: 'More than 1 Acre' },
    ]);
  } else if (ptype === 'house') {
    await sendMsg(to, convId, customerId,
      'How many bedrooms does the property have?\n\n_(Reply with a number e.g. 2, 3, 4)_');
  } else {
    await sendMsg(to, convId, customerId,
      'How many rooms does the property have?\n\n_(Reply with a number e.g. 3, 5, 10)_');
  }
}

async function askBuyerBudget(to: string, convId: string, customerId: string): Promise<void> {
  const wamid = await sendInteractiveList(
    to, 'Select Budget Range', 'What is your budget?', 'Choose Budget',
    [{ title: 'Budget Options', rows: [
      { id: 'b:budget:upto_25l',  title: 'Up to ₹25 Lakh'    },
      { id: 'b:budget:upto_50l',  title: 'Up to ₹50 Lakh'    },
      { id: 'b:budget:upto_75l',  title: 'Up to ₹75 Lakh'    },
      { id: 'b:budget:upto_1cr',  title: 'Up to ₹1 Crore'    },
      { id: 'b:budget:above_1cr', title: 'More than ₹1 Crore' },
    ]}],
  );
  await saveMessage(convId, customerId, 'outbound', 'What is your budget?', wamid ?? undefined);
}

async function askRentBudget(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(to, convId, customerId, 'What is your monthly rental budget?', [
    { id: 'r:budget:rent_15k', title: 'Up to ₹15,000' },
    { id: 'r:budget:rent_25k', title: 'Up to ₹25,000' },
    { id: 'r:budget:rent_50k', title: 'Up to ₹50,000' },
  ]);
}

// ─── Save buyer/renter lead ───────────────────────────────────────────────────

async function saveBuyerLead(conv: ConvState, data: Partial<ConvData>): Promise<void> {
  await db().from('crm_buyer_requests').insert({
    customer_id: conv.customer_id, conversation_id: conv.id,
    requirements: {
      property_type: data.property_type, purpose: conv.intent,
      district: data.district, location: data.location,
      detail: data.detail,
      budget_label: budgetLabel(data.budget ?? ''),
      budget_max: budgetToNumber(data.budget ?? '') || null,
    },
    status: 'new', notes: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await notifyOwner(
    'New ' + (conv.intent === 'rent' ? 'Rental' : 'Buyer') + ' Lead',
    `Type: ${data.property_type} | District: ${data.district}\n` +
    `Location: ${data.location} | Detail: ${data.detail}\n` +
    `Budget: ${budgetLabel(data.budget ?? '')}\n` +
    `Review: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/buyers`
  );
}

// ─── Save seller lead ─────────────────────────────────────────────────────────

async function saveSellerLead(conv: ConvState, data: Partial<ConvData>): Promise<string> {
  const { data: subDoc, error } = await db().from('crm_seller_submissions').insert({
    customer_id: conv.customer_id, conversation_id: conv.id,
    details: {
      property_type: data.property_type, district: data.district,
      location: data.location, detail: data.detail, asking_price: data.asking_price ?? null,
    },
    image_paths: [], approval_status: 'pending_review',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Error('Failed to create seller submission: ' + error.message);
  const submissionId = subDoc.id as string;
  await writeAudit('submission_created', 'crm_seller_submissions', submissionId, conv.customer_id);
  return submissionId;
}

// ─── Seller flow completion ───────────────────────────────────────────────────

async function finishSellerFlow(
  to: string, conv: ConvState, customerId: string, data: Partial<ConvData>,
): Promise<void> {
  if (conv.pending_submission_id) {
    await db().from('crm_seller_submissions')
      .update({ approval_status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('id', conv.pending_submission_id);
  }
  await saveConversation(conv.id, { workflow_status: 's_done' });
  await notifyOwner(
    'New Seller Submission',
    `Type: ${data.property_type} | District: ${data.district}\n` +
    `Location: ${data.location} | Detail: ${data.detail}\n` +
    `Asking: ${formatINR(data.asking_price ?? 0)} | Photos: ${data.image_count ?? 0}\n` +
    `Review: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/sellers`
  );
  const summary =
    `✅ *Your property has been listed for review!*\n\n` +
    `🏘️ Type: ${data.property_type}\n` +
    `📍 District: ${data.district}\n` +
    `🗺️ Location: ${data.location}\n` +
    `📐 Detail: ${data.detail}\n` +
    `💰 Asking Price: ${formatINR(data.asking_price ?? 0)}\n` +
    `📸 Photos: ${data.image_count ?? 0} uploaded\n\n` +
    `Our team will review and get back to you within 24 hours. Thank you! 🙏`;
  await sendMsg(to, conv.id, customerId, summary);
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
  const { from, senderName, body, providerId, mediaId, mimeType } = msg;
  const bodyLower = body.toLowerCase().trim();
  const bodyTrimmed = body.trim();

  // ── Deduplication ──────────────────────────────────────────────────────────
  const { data: dup } = await db().from('crm_webhook_events').select('id')
    .eq('provider_message_id', providerId).limit(1).maybeSingle();
  if (dup) { console.log('[Engine] Duplicate skipped:', providerId); return; }

  await db().from('crm_webhook_events').insert({
    provider_message_id: providerId, from_phone: from,
    body: body || null, media_id: mediaId ?? null, processed_at: new Date().toISOString(),
  });

  const customerId = await getOrCreateCustomer(from, senderName);
  const conv = await getOrCreateConversation(customerId);
  await saveMessage(conv.id, customerId, 'inbound', body, providerId, mediaId, mimeType);

  // ── Paused check ───────────────────────────────────────────────────────────
  if (conv.automation_paused
    && !OPT_IN_KEYWORDS.some(k => bodyLower === k)
    && !OPT_OUT_KEYWORDS.some(k => bodyLower.includes(k))) {
    console.log('[Engine] Paused — skipping automation'); return;
  }

  // ── Opt-in ─────────────────────────────────────────────────────────────────
  if (OPT_IN_KEYWORDS.some(k => bodyLower === k) && conv.opted_out) {
    const text = await handleOptIn(customerId, conv.id);
    await sendMsg(from, conv.id, customerId, text); return;
  }

  // ── Opt-out ────────────────────────────────────────────────────────────────
  if (OPT_OUT_KEYWORDS.some(k => bodyLower.includes(k))) {
    const text = await handleOptOut(customerId, conv.id, from);
    await sendMsg(from, conv.id, customerId, text); return;
  }

  if (conv.opted_out) {
    await sendWhatsAppMessage(from, 'You are unsubscribed. Reply START to re-subscribe.'); return;
  }

  // ── Human agent ────────────────────────────────────────────────────────────
  if (HUMAN_AGENT_KEYWORDS.some(k => bodyLower.includes(k))) {
    await saveConversation(conv.id, { automation_paused: true });
    const ack = 'A team member will contact you shortly. Automated replies have been paused.';
    await sendMsg(from, conv.id, customerId, ack);
    await notifyOwner('Customer Requested Human Agent',
      `Customer ${from} requested a human agent.\nReview: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/inbox`);
    return;
  }

  // ── Greeting / restart ─────────────────────────────────────────────────────
  if (GREETING_KEYWORDS.some(k => bodyLower === k) || conv.workflow_status === 'new') {
    await sendWelcomeMenu(from, conv.id, customerId); return;
  }

  const status = conv.workflow_status;

  // ── AWAITING INTENT ────────────────────────────────────────────────────────
  if (status === 'awaiting_intent') {
    if (bodyTrimmed === 'intent:buy') {
      await saveConversation(conv.id, { intent: 'buy', workflow_status: 'b_type', buyer_data: {} });
      await askBuyerType(from, conv.id, customerId);
    } else if (bodyTrimmed === 'intent:sell') {
      await saveConversation(conv.id, { intent: 'sell', workflow_status: 's_type', seller_data: {} });
      await askSellerType(from, conv.id, customerId);
    } else if (bodyTrimmed === 'intent:rent') {
      await saveConversation(conv.id, { intent: 'rent', workflow_status: 'r_type', buyer_data: {} });
      await askRentType(from, conv.id, customerId);
    } else {
      await sendWelcomeMenu(from, conv.id, customerId);
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUYER FLOW:  b_type → b_district → b_location → b_detail → b_budget → b_done
  // ══════════════════════════════════════════════════════════════════════════

  if (status === 'b_type') {
    if (!bodyTrimmed.startsWith('b:type:')) {
      await sendMsg(from, conv.id, customerId,
        '⚠️ Please use the buttons above to select the property type.');
      await askBuyerType(from, conv.id, customerId); return;
    }
    const ptype = bodyTrimmed.replace('b:type:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), property_type: ptype }, workflow_status: 'b_district' });
    await sendDistrictList(from, conv.id, customerId, 'b', 'Which district are you looking in? 📍');
    return;
  }

  if (status === 'b_district') {
    if (!bodyTrimmed.startsWith('b:district:')) {
      await sendDistrictList(from, conv.id, customerId, 'b', '⚠️ Please select a district from the list below:'); return;
    }
    const district = bodyTrimmed.replace('b:district:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), district }, workflow_status: 'b_location' });
    await sendMsg(from, conv.id, customerId,
      `Great! You selected *${district}*.\n\nPlease type your preferred town / area name and send it 📍`);
    return;
  }

  if (status === 'b_location') {
    if (!bodyTrimmed) {
      await sendMsg(from, conv.id, customerId, 'Please type your preferred town / area name and send it.'); return;
    }
    const ptype = conv.buyer_data?.property_type ?? 'house';
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), location: bodyTrimmed }, workflow_status: 'b_detail' });
    await askBuyerDetail(from, conv.id, customerId, ptype, 'b');
    return;
  }

  if (status === 'b_detail') {
    if (!bodyTrimmed.startsWith('b:detail:')) {
      await askBuyerDetail(from, conv.id, customerId, conv.buyer_data?.property_type ?? 'house', 'b'); return;
    }
    const detail = bodyTrimmed.replace('b:detail:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), detail }, workflow_status: 'b_budget' });
    await askBuyerBudget(from, conv.id, customerId);
    return;
  }

  if (status === 'b_budget') {
    if (!bodyTrimmed.startsWith('b:budget:')) {
      await askBuyerBudget(from, conv.id, customerId); return;
    }
    const budget = bodyTrimmed.replace('b:budget:', '');
    const data = { ...(conv.buyer_data ?? {}), budget };
    await saveConversation(conv.id, { buyer_data: data, workflow_status: 'b_done' });
    await saveBuyerLead(conv, data);
    await sendMsg(from, conv.id, customerId,
      `✅ *Your requirement has been saved!*\n\n` +
      `🏘️ Type: ${data.property_type}\n` +
      `📍 District: ${data.district}\n` +
      `🗺️ Location: ${data.location}\n` +
      `🛏️ Preference: ${data.detail}\n` +
      `💰 Budget: ${budgetLabel(budget)}\n\n` +
      `Thank you! Our team will contact you once a matching property is found. 🙏`);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENTAL FLOW:  r_type → r_district → r_location → r_detail → r_budget → r_done
  // ══════════════════════════════════════════════════════════════════════════

  if (status === 'r_type') {
    if (!bodyTrimmed.startsWith('r:type:')) {
      await askRentType(from, conv.id, customerId); return;
    }
    const ptype = bodyTrimmed.replace('r:type:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), property_type: ptype }, workflow_status: 'r_district' });
    await sendDistrictList(from, conv.id, customerId, 'r', 'Which district are you looking in? 📍');
    return;
  }

  if (status === 'r_district') {
    if (!bodyTrimmed.startsWith('r:district:')) {
      await sendDistrictList(from, conv.id, customerId, 'r', '⚠️ Please select a district from the list below:'); return;
    }
    const district = bodyTrimmed.replace('r:district:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), district }, workflow_status: 'r_location' });
    await sendMsg(from, conv.id, customerId,
      `Great! You selected *${district}*.\n\nPlease type your preferred town / area name and send it 📍`);
    return;
  }

  if (status === 'r_location') {
    if (!bodyTrimmed) {
      await sendMsg(from, conv.id, customerId, 'Please type your preferred town / area name and send it.'); return;
    }
    const ptype = conv.buyer_data?.property_type ?? 'house';
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), location: bodyTrimmed }, workflow_status: 'r_detail' });
    await askBuyerDetail(from, conv.id, customerId, ptype, 'r');
    return;
  }

  if (status === 'r_detail') {
    if (!bodyTrimmed.startsWith('r:detail:')) {
      await askBuyerDetail(from, conv.id, customerId, conv.buyer_data?.property_type ?? 'house', 'r'); return;
    }
    const detail = bodyTrimmed.replace('r:detail:', '');
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), detail }, workflow_status: 'r_budget' });
    await askRentBudget(from, conv.id, customerId);
    return;
  }

  if (status === 'r_budget') {
    if (!bodyTrimmed.startsWith('r:budget:')) {
      await askRentBudget(from, conv.id, customerId); return;
    }
    const budget = bodyTrimmed.replace('r:budget:', '');
    const data = { ...(conv.buyer_data ?? {}), budget };
    await saveConversation(conv.id, { buyer_data: data, workflow_status: 'r_done' });
    await saveBuyerLead(conv, data);
    await sendMsg(from, conv.id, customerId,
      `✅ *Your rental requirement has been saved!*\n\n` +
      `🏘️ Type: ${data.property_type}\n` +
      `📍 District: ${data.district}\n` +
      `🗺️ Location: ${data.location}\n` +
      `🛏️ Preference: ${data.detail}\n` +
      `💰 Budget: ${budgetLabel(budget)}\n\n` +
      `Thank you! Our team will contact you once a matching property is found. 🙏`);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SELLER FLOW:  s_type → s_district → s_location → s_detail → s_price → s_photos → s_done
  // ══════════════════════════════════════════════════════════════════════════

  if (status === 's_type') {
    if (!bodyTrimmed.startsWith('s:type:')) {
      await askSellerType(from, conv.id, customerId); return;
    }
    const ptype = bodyTrimmed.replace('s:type:', '');
    await saveConversation(conv.id, { seller_data: { property_type: ptype }, workflow_status: 's_district' });
    await sendDistrictList(from, conv.id, customerId, 's', 'Which district is the property in? 📍');
    return;
  }

  if (status === 's_district') {
    if (!bodyTrimmed.startsWith('s:district:')) {
      await sendDistrictList(from, conv.id, customerId, 's', '⚠️ Please select a district from the list below:'); return;
    }
    const district = bodyTrimmed.replace('s:district:', '');
    await saveConversation(conv.id, { seller_data: { ...(conv.seller_data ?? {}), district }, workflow_status: 's_location' });
    await sendMsg(from, conv.id, customerId,
      `Great! You selected *${district}*.\n\nPlease type the town / area name and send it 📍`);
    return;
  }

  if (status === 's_location') {
    if (!bodyTrimmed) {
      await sendMsg(from, conv.id, customerId, 'Please type the town / area name and send it.'); return;
    }
    const ptype = conv.seller_data?.property_type ?? 'house';
    await saveConversation(conv.id, { seller_data: { ...(conv.seller_data ?? {}), location: bodyTrimmed }, workflow_status: 's_detail' });
    await askSellerDetail(from, conv.id, customerId, ptype);
    return;
  }

  if (status === 's_detail') {
    const ptype = conv.seller_data?.property_type ?? 'house';
    let detail: string;

    if (ptype === 'plot') {
      if (!bodyTrimmed.startsWith('s:detail:')) {
        await askSellerDetail(from, conv.id, customerId, ptype); return;
      }
      detail = bodyTrimmed.replace('s:detail:', '');
    } else {
      const num = parseInt(bodyTrimmed, 10);
      if (isNaN(num) || num <= 0) {
        const hint = ptype === 'house'
          ? '⚠️ Please reply with the number of bedrooms (e.g. 2, 3, 4).'
          : '⚠️ Please reply with the number of rooms (e.g. 3, 5, 10).';
        await sendMsg(from, conv.id, customerId, hint); return;
      }
      detail = String(num);
    }

    await saveConversation(conv.id, { seller_data: { ...(conv.seller_data ?? {}), detail }, workflow_status: 's_price' });
    await sendMsg(from, conv.id, customerId,
      'What is your asking price?\n\n_(Reply with the amount in numbers, e.g. 2500000 for ₹25 Lakh)_');
    return;
  }

  if (status === 's_price') {
    const raw = bodyTrimmed.replace(/[,₹\s]/g, '');
    const price = parseInt(raw, 10);
    if (isNaN(price) || price <= 0) {
      await sendMsg(from, conv.id, customerId,
        '⚠️ Please reply with the asking price in numbers only (e.g. 2500000 for ₹25 Lakh).'); return;
    }
    const data = { ...(conv.seller_data ?? {}), asking_price: price };
    await saveConversation(conv.id, { seller_data: data, workflow_status: 's_photos' });
    const submissionId = await saveSellerLead({ ...conv, seller_data: data }, data);
    await saveConversation(conv.id, { pending_submission_id: submissionId });
    await sendMsg(from, conv.id, customerId,
      `Got it — *${formatINR(price)}*.\n\n` +
      `📸 Please send property photos now (up to 5 images).\n\n` +
      `If you don't have photos ready, type *done* to skip.`);
    return;
  }

  if (status === 's_photos') {
    const data = conv.seller_data ?? {};
    const imageCount = (data.image_count ?? 0);

    if (mediaId && conv.pending_submission_id) {
      try {
        const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
        const { storagePath } = await downloadAndStoreMedia(mediaId, conv.pending_submission_id, token);
        const { data: sub } = await db().from('crm_seller_submissions').select('image_paths')
          .eq('id', conv.pending_submission_id).single();
        const newPaths = [...((sub?.image_paths as string[]) ?? []), storagePath];
        await db().from('crm_seller_submissions')
          .update({ image_paths: newPaths, updated_at: new Date().toISOString() })
          .eq('id', conv.pending_submission_id);
        const newCount = newPaths.length;
        await saveConversation(conv.id, { seller_data: { ...data, image_count: newCount } });
        if (newCount < 5) {
          await sendMsg(from, conv.id, customerId,
            `📸 Photo ${newCount} received! You can send ${5 - newCount} more, or type *done* to finish.`);
        } else {
          await finishSellerFlow(from, { ...conv, seller_data: { ...data, image_count: newCount } }, customerId, { ...data, image_count: newCount });
        }
      } catch (err) {
        console.error('[Media upload error]', err);
        await sendMsg(from, conv.id, customerId, 'Sorry, error uploading your photo. Please try again.');
      }
      return;
    }

    if (['done', 'no photos', 'skip'].includes(bodyLower) || imageCount >= 5) {
      await finishSellerFlow(from, conv, customerId, data); return;
    }

    await sendMsg(from, conv.id, customerId,
      `📸 Please send a property photo, or type *done* to finish.\n_(${imageCount} photo${imageCount !== 1 ? 's' : ''} received so far)_`);
    return;
  }

  // ── Completed flows ────────────────────────────────────────────────────────
  if (['b_done', 'r_done', 's_done'].includes(status)) {
    await sendMsg(from, conv.id, customerId,
      `Your inquiry is already saved! 🙏\n\nType *Hi* to submit a new inquiry or get assistance.`);
    return;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  await sendWelcomeMenu(from, conv.id, customerId);
}
