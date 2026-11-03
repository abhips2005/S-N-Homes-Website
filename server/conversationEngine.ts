/**
 * Conversation Engine — stateful WhatsApp conversation orchestrator.
 * Pure state-machine, NO AI/Gemini dependency.
 * Uses Supabase PostgreSQL (via service role client).
 */
import { createHash } from 'crypto';
import { getSupabase, writeAudit } from './supabaseAdmin';
import { downloadAndStoreMedia } from './mediaService';

// ─── Kerala regions & districts ───────────────────────────────────────────────

export const KERALA_REGIONS = {
  south: {
    name: 'South Kerala',
    label: '🌴 South Kerala',
    districts: ['Alappuzha', 'Kollam', 'Kottayam', 'Pathanamthitta', 'Thiruvananthapuram'],
  },
  central: {
    name: 'Central Kerala',
    label: '🏙️ Central Kerala',
    districts: ['Ernakulam', 'Idukki', 'Palakkad', 'Thrissur'],
  },
  north: {
    name: 'North Kerala',
    label: '🌄 North Kerala',
    districts: ['Kannur', 'Kasaragod', 'Kozhikode', 'Malappuram', 'Wayanad'],
  },
} as const;

export const KERALA_DISTRICTS: string[] = [
  ...KERALA_REGIONS.south.districts,
  ...KERALA_REGIONS.central.districts,
  ...KERALA_REGIONS.north.districts,
];

export const DISTRICT_ALIASES: Record<string, string> = {
  trivandrum: 'Thiruvananthapuram',
  tvm: 'Thiruvananthapuram',
  thiruvananthapuram: 'Thiruvananthapuram',
  quilon: 'Kollam',
  kollam: 'Kollam',
  pathanamthitta: 'Pathanamthitta',
  alleppey: 'Alappuzha',
  alappuzha: 'Alappuzha',
  kottayam: 'Kottayam',
  idukki: 'Idukki',
  cochin: 'Ernakulam',
  kochi: 'Ernakulam',
  ernakulam: 'Ernakulam',
  eranakulam: 'Ernakulam',
  thrissur: 'Thrissur',
  trichur: 'Thrissur',
  palakkad: 'Palakkad',
  palghat: 'Palakkad',
  malappuram: 'Malappuram',
  calicut: 'Kozhikode',
  kozhikode: 'Kozhikode',
  wayanad: 'Wayanad',
  wyanad: 'Wayanad',
  kannur: 'Kannur',
  cannanore: 'Kannur',
  kasaragod: 'Kasaragod',
  kasargod: 'Kasaragod',
  // Malayalam
  'തിരുവനന്തപുരം': 'Thiruvananthapuram',
  'കൊല്ലം': 'Kollam',
  'പത്തനംതിട്ട': 'Pathanamthitta',
  'ആലപ്പുഴ': 'Alappuzha',
  'കോട്ടയം': 'Kottayam',
  'ഇടുക്കി': 'Idukki',
  'എറണാകുളം': 'Ernakulam',
  'കൊച്ചി': 'Ernakulam',
  'തൃശ്ശൂർ': 'Thrissur',
  'പാലക്കാട്': 'Palakkad',
  'മലപ്പുറം': 'Malappuram',
  'കോഴിക്കോട്': 'Kozhikode',
  'വയനാട്': 'Wayanad',
  'കണ്ണൂർ': 'Kannur',
  'കാസർഗോഡ്': 'Kasaragod',
  'കാസർകോട്': 'Kasaragod',
};

export function resolveDistrict(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (DISTRICT_ALIASES[raw]) return DISTRICT_ALIASES[raw];
  const clean = raw.replace(/[^a-z]/g, '');
  if (clean && DISTRICT_ALIASES[clean]) return DISTRICT_ALIASES[clean];
  for (const d of KERALA_DISTRICTS) {
    const dLower = d.toLowerCase();
    if (raw === dLower || (clean && clean === dLower.replace(/[^a-z]/g, ''))) return d;
    if (dLower.length > 4 && raw.includes(dLower)) return d;
  }
  return null;
}

export function resolveBudget(body: string): string | null {
  const clean = body.trim().toLowerCase();
  if (clean.startsWith('b:budget:')) return clean.replace('b:budget:', '');
  if (clean.includes('25')) return 'upto_25l';
  if (clean.includes('50')) return 'upto_50l';
  if (clean.includes('75')) return 'upto_75l';
  if (clean.includes('1cr') || clean.includes('1 cr') || clean.includes('crore')) return 'upto_1cr';
  if (clean.includes('above') || clean.includes('more')) return 'above_1cr';
  return null;
}

export function resolveRentBudget(body: string): string | null {
  const clean = body.trim().toLowerCase();
  if (clean.startsWith('r:budget:')) return clean.replace('r:budget:', '');
  if (clean.includes('15')) return 'rent_15k';
  if (clean.includes('25')) return 'rent_25k';
  if (clean.includes('50')) return 'rent_50k';
  return null;
}

export function resolveDetail(body: string, ptype: string, prefix: 'b' | 'r'): string | null {
  const clean = body.trim().toLowerCase();
  const tag = `${prefix}:detail:`;
  if (clean.startsWith(tag)) return clean.replace(tag, '');
  if (ptype === 'house') {
    if (clean.includes('2')) return '2plus';
    if (clean.includes('3')) return '3plus';
    if (clean.includes('4') || clean.includes('5')) return '4plus';
  } else if (ptype === 'plot') {
    if (clean.includes('big') || clean.includes('more') || clean.includes('above')) return 'above50cent';
    if (clean.includes('20')) return '20cent';
    if (clean.includes('50')) return '50cent';
    if (clean.includes('1') || clean.includes('acre')) return '1acre';
    if (clean.includes('cent')) return '20cent';
  } else {
    if (clean.includes('5')) return '5rooms';
    if (clean.includes('10')) return '10rooms';
    if (clean.includes('big') || clean.includes('more')) return 'big';
  }
  return null;
}


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
  land_area?: string | number;
  land_area_unit?: string;
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

// ─── Interactive button message (max 3 buttons, max 20 chars title) ───────────

export async function sendInteractiveButtons(
  to: string, bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return null;

  // WhatsApp limits: max 3 buttons, title max 20 chars
  const sanitizedButtons = buttons.slice(0, 3).map(b => ({
    id: b.id.slice(0, 256),
    title: b.title.slice(0, 20),
  }));

  const res = await fetch('https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
      interactive: {
        type: 'button', body: { text: bodyText.slice(0, 1024) },
        action: { buttons: sanitizedButtons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[WA interactive error]', errText);
    return null;
  }
  const data = await res.json() as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

// ─── Interactive list message (max 10 rows total, titles max 24 chars) ────────

interface ListItem { id: string; title: string; description?: string }
interface ListSection { title: string; rows: ListItem[] }

async function sendInteractiveList(
  to: string, headerText: string, bodyText: string,
  buttonLabel: string, sections: ListSection[],
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return null;

  // WhatsApp limit: Total rows across all sections must be between 1 and 10!
  const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);
  if (totalRows === 0 || totalRows > 10) {
    console.error(`[WA list error] Total rows must be 1..10 (got ${totalRows})`);
    return null;
  }

  const res = await fetch('https://graph.facebook.com/v26.0/' + phoneNumberId + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText.slice(0, 60) },
        body: { text: bodyText.slice(0, 1024) },
        action: {
          button: buttonLabel.slice(0, 20),
          sections: sections.map(s => ({
            title: s.title.slice(0, 24),
            rows: s.rows.map(r => ({
              id: r.id.slice(0, 200),
              title: r.title.slice(0, 24),
              description: r.description ? r.description.slice(0, 72) : undefined,
            })),
          })),
        },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[WA list error]', errText);
    return null;
  }
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
        from: { email: 'noreply@snhomes.in', name: 'S N Homes CRM' },
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
  return 'You have been unsubscribed from S N Homes messages. Reply START to re-subscribe.';
}

async function handleOptIn(customerId: string, convId: string): Promise<string> {
  await db().from('crm_customers').update({ opted_out: false }).eq('id', customerId);
  await saveConversation(convId, { opted_out: false, automation_paused: false });
  return 'Welcome back! You are subscribed to S N Homes updates. Say *Hi* to get the main menu.';
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

// ─── District region & list senders ───────────────────────────────────────────

/**
 * Step 1: Quick-pick — Kottayam | Ernakulam | Other
 * "Other" leads to the region picker (North / Central / South).
 */
async function askDistrictQuick(
  to: string, convId: string, customerId: string,
  prefix: 'b' | 'r' | 's', question: string,
): Promise<void> {
  await sendBtns(
    to, convId, customerId,
    `${question}\n\nSelect your district:`,
    [
      { id: `${prefix}:district:Kottayam`,  title: '🏡 Kottayam' },
      { id: `${prefix}:district:Ernakulam`, title: '🏙️ Ernakulam' },
      { id: `${prefix}:reg:other`,          title: '🗺️ Other' },
    ],
  );
}

/**
 * Step 2 (only if "Other" chosen): Region picker — North | Central | South
 */
async function askDistrictRegion(
  to: string, convId: string, customerId: string,
  prefix: 'b' | 'r' | 's', question: string,
): Promise<void> {
  await sendBtns(
    to, convId, customerId,
    `${question}\n\nSelect a region below, or reply with your district name 📍`,
    [
      { id: `${prefix}:reg:north`,   title: '🌄 North Kerala' },
      { id: `${prefix}:reg:central`, title: '🏙️ Central Kerala' },
      { id: `${prefix}:reg:south`,   title: '🌴 South Kerala' },
    ],
  );
}

async function sendDistrictListForRegion(
  to: string, convId: string, customerId: string,
  prefix: 'b' | 'r' | 's', regionKey: 'south' | 'central' | 'north',
): Promise<void> {
  const reg = KERALA_REGIONS[regionKey];
  const rows = reg.districts.map(d => ({ id: `${prefix}:district:${d}`, title: d }));
  const wamid = await sendInteractiveList(
    to,
    reg.name,
    `Select your district in ${reg.name}:`,
    'Choose District',
    [{ title: `${reg.name} (${rows.length})`, rows }],
  );
  if (!wamid) {
    const fallbackText = `*${reg.label}:*\n\n` +
      reg.districts.map((d, i) => `${i + 1}. ${d}`).join('\n') +
      `\n\nPlease reply with your district name 📍`;
    await sendMsg(to, convId, customerId, fallbackText);
    return;
  }
  await saveMessage(convId, customerId, 'outbound', `Select your district in ${reg.name}`, wamid);
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
  if (!wamid) {
    // Fallback to text message if interactive buttons fail
    const fallbackText = `${text}\n\n` +
      buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n') +
      `\n\n_(Reply with your choice)_`;
    await sendMsg(to, convId, customerId, fallbackText);
    return;
  }
  await saveMessage(convId, customerId, 'outbound', text, wamid);
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
      { id: `${prefix}:detail:20cent`,      title: 'Upto 20 cent' },
      { id: `${prefix}:detail:50cent`,      title: 'Upto 50 cent' },
      { id: `${prefix}:detail:above50cent`, title: 'More than 50 cent' },
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
      { id: 's:detail:20cent',      title: 'Upto 20 cent' },
      { id: 's:detail:50cent',      title: 'Upto 50 cent' },
      { id: 's:detail:above50cent', title: 'More than 50 cent' },
    ]);
  } else if (ptype === 'house') {
    await sendMsg(to, convId, customerId,
      'How many bedrooms does the property have?\n\n_(Reply with a number e.g. 2, 3, 4)_');
  } else {
    await sendMsg(to, convId, customerId,
      'How many rooms does the property have?\n\n_(Reply with a number e.g. 3, 5, 10)_');
  }
}

async function askBuyerLandArea(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(to, convId, customerId, 'What is your preferred land area / plot size?', [
    { id: 'b:land:20cent',      title: 'Upto 20 cent' },
    { id: 'b:land:50cent',      title: 'Upto 50 cent' },
    { id: 'b:land:above50cent', title: 'More than 50 cent' },
  ]);
}

async function askSellerLandArea(to: string, convId: string, customerId: string): Promise<void> {
  await sendBtns(
    to, convId, customerId,
    'What is the land area of the property?\n\nSelect an option or reply with exact area (e.g. 7 Cent, 15 Cent, 1 Acre):',
    [
      { id: 's:land:20cent',      title: 'Upto 20 cent' },
      { id: 's:land:50cent',      title: 'Upto 50 cent' },
      { id: 's:land:above50cent', title: 'More than 50 cent' },
    ],
  );
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
  const reqObj: Record<string, unknown> = {
    property_type: data.property_type,
    purpose: conv.intent,
    district: data.district,
    location: data.location,
    locations: data.location ? [data.location] : [],
    detail: data.detail,
    land_area: data.land_area ?? (data.property_type === 'plot' ? data.detail : undefined),
    budget_label: budgetLabel(data.budget ?? ''),
    budget_max: budgetToNumber(data.budget ?? '') || null,
  };

  if (data.detail) {
    const num = parseInt(data.detail, 10);
    if (!isNaN(num)) {
      reqObj.bedrooms_min = num;
    }
  }

  await db().from('crm_buyer_requests').insert({
    customer_id: conv.customer_id,
    conversation_id: conv.id,
    requirements: reqObj,
    status: 'new',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await notifyOwner(
    'New ' + (conv.intent === 'rent' ? 'Rental' : 'Buyer') + ' Lead',
    `Type: ${data.property_type} | District: ${data.district}\n` +
    `Location: ${data.location} | Detail: ${data.detail}\n` +
    (data.land_area ? `Land Area: ${data.land_area}\n` : '') +
    `Budget: ${budgetLabel(data.budget ?? '')}\n` +
    `Review: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/buyers`
  );
}

// ─── Save seller lead ─────────────────────────────────────────────────────────

async function saveSellerLead(conv: ConvState, data: Partial<ConvData>): Promise<string> {
  const detailsObj: Record<string, unknown> = {
    property_type: data.property_type,
    district: data.district,
    location: data.location,
    detail: data.detail,
    land_area: data.land_area ?? (data.property_type === 'plot' ? data.detail : null),
    land_area_unit: data.land_area_unit || 'cent',
    asking_price: data.asking_price ?? null,
  };

  if (data.detail) {
    const num = parseInt(data.detail, 10);
    if (!isNaN(num)) {
      if (data.property_type === 'house') {
        detailsObj.bedrooms = num;
      }
      detailsObj.rooms = num;
    }
  }

  const { data: subDoc, error } = await db().from('crm_seller_submissions').insert({
    customer_id: conv.customer_id,
    conversation_id: conv.id,
    details: detailsObj,
    image_paths: [],
    approval_status: 'pending_review',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    const detailsObj: Record<string, unknown> = {
      property_type: data.property_type,
      district: data.district,
      location: data.location,
      detail: data.detail,
      land_area: data.land_area ?? (data.property_type === 'plot' ? data.detail : null),
      land_area_unit: data.land_area_unit || 'cent',
      asking_price: data.asking_price ?? null,
    };
    if (data.detail) {
      const num = parseInt(data.detail, 10);
      if (!isNaN(num)) {
        if (data.property_type === 'house') {
          detailsObj.bedrooms = num;
        }
        detailsObj.rooms = num;
      }
    }
    await db().from('crm_seller_submissions')
      .update({
        details: detailsObj,
        approval_status: 'pending_review',
        updated_at: new Date().toISOString()
      })
      .eq('id', conv.pending_submission_id);
  }
  await saveConversation(conv.id, { workflow_status: 's_done' });
  await notifyOwner(
    'New Seller Submission',
    `Type: ${data.property_type} | District: ${data.district}\n` +
    `Location: ${data.location} | Detail: ${data.detail}\n` +
    (data.land_area ? `Land Area: ${data.land_area} ${data.land_area_unit || ''}\n` : '') +
    `Asking: ${formatINR(data.asking_price ?? 0)} | Photos: ${data.image_count ?? 0}\n` +
    `Review: ${process.env.WEBSITE_BASE_URL ?? 'https://snhomes.in'}/admin/crm/sellers`
  );
  const summary =
    `✅ *Your property has been listed for review!*\n\n` +
    `🏘️ Type: ${data.property_type}\n` +
    `📍 District: ${data.district}\n` +
    `🗺️ Location: ${data.location}\n` +
    (data.property_type === 'house' ? `🛏️ Bedrooms: ${data.detail}\n` : '') +
    (data.property_type === 'commercial' ? `🏢 Rooms: ${data.detail}\n` : '') +
    (data.land_area ? `📐 Land Area: ${data.land_area} ${data.land_area_unit || ''}\n` : (data.property_type === 'plot' ? `📐 Land Area: ${data.detail}\n` : '')) +
    `💰 Asking Price: ${formatINR(data.asking_price ?? 0)}\n` +
    `📸 Photos: ${data.image_count ?? 0} uploaded\n\n` +
    `Our team will review and get back to you within 24 hours. Thank you! 🙏`;
  await sendMsg(to, conv.id, customerId, summary);
}

// ─── Photo batch debouncer ───────────────────────────────────────────────────

interface PhotoBatch {
  timer: NodeJS.Timeout;
  from: string;
  convId: string;
  customerId: string;
  submissionId: string;
  expectedCount: number;
}

const photoBatchTimers = new Map<string, PhotoBatch>();

export async function hasPendingJobsForSender(from: string): Promise<boolean> {
  try {
    const { data, error } = await db()
      .from('crm_job_queue')
      .select('payload')
      .eq('status', 'pending')
      .limit(30);
    if (error || !data) return false;
    return data.some(j => (j.payload as { msg?: { from?: string } })?.msg?.from === from);
  } catch {
    return false;
  }
}

function schedulePhotoBatchNotification(
  from: string,
  conv: ConvState,
  customerId: string,
  submissionId: string,
  expectedCount: number,
): void {
  const existing = photoBatchTimers.get(conv.id);
  if (existing) {
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(async () => {
    photoBatchTimers.delete(conv.id);
    try {
      // If more messages are already in queue for this sender, cancel notification
      if (await hasPendingJobsForSender(from)) {
        console.log(`[Photo Batch] More messages pending for ${from}, skipping scheduled notification.`);
        return;
      }

      // Check current conversation state - ensure it's still waiting for photos
      const currentConv = await getOrCreateConversation(customerId);
      if (currentConv.workflow_status !== 's_photos') {
        console.log(`[Photo Batch] Conversation ${conv.id} is no longer in s_photos (${currentConv.workflow_status}), skipping.`);
        return;
      }

      const { data: sub } = await db()
        .from('crm_seller_submissions')
        .select('image_paths')
        .eq('id', submissionId)
        .single();
      const currentPaths = ((sub?.image_paths as string[]) ?? []);
      const count = currentPaths.length;

      // If more photos have been added since scheduling, a later schedule/finish will handle it
      if (count > expectedCount) {
        return;
      }

      const data = currentConv.seller_data ?? {};

      if (count >= 5) {
        await finishSellerFlow(
          from,
          { ...currentConv, seller_data: { ...data, image_count: count } },
          customerId,
          { ...data, image_count: count },
        );
      } else {
        const remaining = 5 - count;
        const photoWord = count === 1 ? 'photo' : 'photos';
        await sendMsg(
          from,
          conv.id,
          customerId,
          `📸 ${count} ${photoWord} received! You can send ${remaining} more, or type *done* to finish.`,
        );
      }
    } catch (err) {
      console.error('[Photo batch notification error]', err);
    }
  }, 3000);

  photoBatchTimers.set(conv.id, { timer, from, convId: conv.id, customerId, submissionId, expectedCount });
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
    const isBuy = bodyTrimmed === 'intent:buy' || /buy|വാങ്ങുക/i.test(bodyTrimmed) || bodyTrimmed === '1';
    const isSell = bodyTrimmed === 'intent:sell' || /sell|വിൽക്കുക/i.test(bodyTrimmed) || bodyTrimmed === '2';
    const isRent = bodyTrimmed === 'intent:rent' || /rent|വാടക/i.test(bodyTrimmed) || bodyTrimmed === '3';

    if (isBuy) {
      await saveConversation(conv.id, { intent: 'buy', workflow_status: 'b_type', buyer_data: {} });
      await askBuyerType(from, conv.id, customerId);
    } else if (isSell) {
      await saveConversation(conv.id, { intent: 'sell', workflow_status: 's_type', seller_data: {} });
      await askSellerType(from, conv.id, customerId);
    } else if (isRent) {
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
    let ptype: string | null = null;
    if (bodyTrimmed.startsWith('b:type:')) ptype = bodyTrimmed.replace('b:type:', '');
    else if (/house|home|villa|വീട്|1/i.test(bodyTrimmed)) ptype = 'house';
    else if (/plot|land|സ്ഥലം|2/i.test(bodyTrimmed)) ptype = 'plot';
    else if (/commercial|shop|office|കട|3/i.test(bodyTrimmed)) ptype = 'commercial';

    if (!ptype) {
      await sendMsg(from, conv.id, customerId,
        '⚠️ Please use the buttons above to select the property type.');
      await askBuyerType(from, conv.id, customerId); return;
    }

    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), property_type: ptype }, workflow_status: 'b_district' });
    await askDistrictQuick(from, conv.id, customerId, 'b', 'Which district in Kerala are you looking in? 📍');
    return;
  }

  if (status === 'b_district') {
    // 1. "Other" quick-pick → show region picker
    if (bodyTrimmed === 'b:reg:other' || /other/i.test(bodyTrimmed) || /മറ്റുള്ളവ/.test(bodyTrimmed)) {
      await askDistrictRegion(from, conv.id, customerId, 'b', 'Which region in Kerala are you looking in? 📍');
      return;
    }

    // 2. Region selection (from region picker: North, Central, South)
    let regKey: 'south' | 'central' | 'north' | null = null;
    if (bodyTrimmed.startsWith('b:reg:')) regKey = bodyTrimmed.replace('b:reg:', '') as any;
    else if (/north|വടക്ക്/i.test(bodyTrimmed)) regKey = 'north';
    else if (/central|മധ്യം/i.test(bodyTrimmed)) regKey = 'central';
    else if (/south|തെക്ക്/i.test(bodyTrimmed)) regKey = 'south';

    if (regKey && KERALA_REGIONS[regKey]) {
      await sendDistrictListForRegion(from, conv.id, customerId, 'b', regKey);
      return;
    }

    // 3. District selection (quick-pick button or list or direct text entry)
    let district: string | null = null;
    if (bodyTrimmed.startsWith('b:district:')) {
      district = bodyTrimmed.replace('b:district:', '');
    } else {
      district = resolveDistrict(bodyTrimmed);
    }

    if (district) {
      await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), district }, workflow_status: 'b_location' });
      await sendMsg(from, conv.id, customerId,
        `Great! You selected *${district}*.\n\nPlease type your preferred town / area name and send it 📍`);
      return;
    }

    await askDistrictQuick(from, conv.id, customerId, 'b', '⚠️ Please select your district:');
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
    const ptype = conv.buyer_data?.property_type ?? 'house';
    const detail = resolveDetail(bodyTrimmed, ptype, 'b');
    if (!detail) {
      await askBuyerDetail(from, conv.id, customerId, ptype, 'b'); return;
    }

    if (ptype === 'plot') {
      // For plot/land, detail is the land area
      const displayArea = (detail === '20cent' || detail === '10cent') ? 'Upto 20 cent'
        : (detail === '50cent' || detail === '25cent') ? 'Upto 50 cent'
        : (detail === 'above50cent' || detail === 'big') ? 'More than 50 cent'
        : detail;
      await saveConversation(conv.id, {
        buyer_data: { ...(conv.buyer_data ?? {}), detail: displayArea, land_area: displayArea },
        workflow_status: 'b_budget'
      });
      await askBuyerBudget(from, conv.id, customerId);
      return;
    }

    // For house and commercial: ask land area next
    await saveConversation(conv.id, {
      buyer_data: { ...(conv.buyer_data ?? {}), detail },
      workflow_status: 'b_land_area'
    });
    await askBuyerLandArea(from, conv.id, customerId);
    return;
  }

  if (status === 'b_land_area') {
    let landArea = '';
    if (bodyTrimmed === 'b:land:20cent' || bodyTrimmed === 'b:land:10cent' || /^upto\s*20/i.test(bodyTrimmed)) {
      landArea = 'Upto 20 cent';
    } else if (bodyTrimmed === 'b:land:50cent' || bodyTrimmed === 'b:land:25cent' || /^upto\s*50/i.test(bodyTrimmed)) {
      landArea = 'Upto 50 cent';
    } else if (bodyTrimmed === 'b:land:above50cent' || bodyTrimmed === 'b:land:big' || /more\s*than\s*50/i.test(bodyTrimmed) || /above\s*50/i.test(bodyTrimmed)) {
      landArea = 'More than 50 cent';
    } else if (bodyTrimmed) {
      landArea = bodyTrimmed;
    }

    if (!landArea) {
      await askBuyerLandArea(from, conv.id, customerId); return;
    }

    await saveConversation(conv.id, {
      buyer_data: { ...(conv.buyer_data ?? {}), land_area: landArea },
      workflow_status: 'b_budget'
    });
    await askBuyerBudget(from, conv.id, customerId);
    return;
  }

  if (status === 'b_budget') {
    const budget = resolveBudget(bodyTrimmed);
    if (!budget) {
      await askBuyerBudget(from, conv.id, customerId); return;
    }
    const data = { ...(conv.buyer_data ?? {}), budget };
    await saveConversation(conv.id, { buyer_data: data, workflow_status: 'b_done' });
    await saveBuyerLead(conv, data);
    await sendMsg(from, conv.id, customerId,
      `✅ *Your requirement has been saved!*\n\n` +
      `🏘️ Type: ${data.property_type}\n` +
      `📍 District: ${data.district}\n` +
      `🗺️ Location: ${data.location}\n` +
      (data.property_type === 'house' ? `🛏️ Preference: ${data.detail} BHK\n` : '') +
      (data.property_type === 'commercial' ? `🏢 Preference: ${data.detail} Rooms\n` : '') +
      (data.land_area ? `📐 Land Area: ${data.land_area}\n` : (data.property_type === 'plot' ? `📐 Preference: ${data.detail}\n` : '')) +
      `💰 Budget: ${budgetLabel(budget)}\n\n` +
      `Thank you! Our team will contact you once a matching property is found. 🙏`);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENTAL FLOW:  r_type → r_district → r_location → r_detail → r_budget → r_done
  // ══════════════════════════════════════════════════════════════════════════

  if (status === 'r_type') {
    let ptype: string | null = null;
    if (bodyTrimmed.startsWith('r:type:')) ptype = bodyTrimmed.replace('r:type:', '');
    else if (/house|home|villa|flat|apartment|വീട്|1/i.test(bodyTrimmed)) ptype = 'house';
    else if (/commercial|shop|office|കട|2/i.test(bodyTrimmed)) ptype = 'commercial';

    if (!ptype) {
      await askRentType(from, conv.id, customerId); return;
    }
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), property_type: ptype }, workflow_status: 'r_district' });
    await askDistrictQuick(from, conv.id, customerId, 'r', 'Which district in Kerala are you looking to rent in? 📍');
    return;
  }

  if (status === 'r_district') {
    // 1. "Other" quick-pick → show region picker
    if (bodyTrimmed === 'r:reg:other' || /other/i.test(bodyTrimmed) || /മറ്റുള്ളവ/.test(bodyTrimmed)) {
      await askDistrictRegion(from, conv.id, customerId, 'r', 'Which region in Kerala are you looking to rent in? 📍');
      return;
    }

    // 2. Region selection (from region picker: North, Central, South)
    let regKey: 'south' | 'central' | 'north' | null = null;
    if (bodyTrimmed.startsWith('r:reg:')) regKey = bodyTrimmed.replace('r:reg:', '') as any;
    else if (/north|വടക്ക്/i.test(bodyTrimmed)) regKey = 'north';
    else if (/central|മധ്യം/i.test(bodyTrimmed)) regKey = 'central';
    else if (/south|തെക്ക്/i.test(bodyTrimmed)) regKey = 'south';

    if (regKey && KERALA_REGIONS[regKey]) {
      await sendDistrictListForRegion(from, conv.id, customerId, 'r', regKey);
      return;
    }

    // 3. District selection (quick-pick button or list or direct text entry)
    let district: string | null = null;
    if (bodyTrimmed.startsWith('r:district:')) {
      district = bodyTrimmed.replace('r:district:', '');
    } else {
      district = resolveDistrict(bodyTrimmed);
    }

    if (district) {
      await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), district }, workflow_status: 'r_location' });
      await sendMsg(from, conv.id, customerId,
        `Great! You selected *${district}*.\n\nPlease type your preferred town / area name and send it 📍`);
      return;
    }

    await askDistrictQuick(from, conv.id, customerId, 'r', '⚠️ Please select your district:');
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
    const ptype = conv.buyer_data?.property_type ?? 'house';
    const detail = resolveDetail(bodyTrimmed, ptype, 'r');
    if (!detail) {
      await askBuyerDetail(from, conv.id, customerId, ptype, 'r'); return;
    }
    await saveConversation(conv.id, { buyer_data: { ...(conv.buyer_data ?? {}), detail }, workflow_status: 'r_budget' });
    await askRentBudget(from, conv.id, customerId);
    return;
  }

  if (status === 'r_budget') {
    const budget = resolveRentBudget(bodyTrimmed);
    if (!budget) {
      await askRentBudget(from, conv.id, customerId); return;
    }
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
    let ptype: string | null = null;
    if (bodyTrimmed.startsWith('s:type:')) ptype = bodyTrimmed.replace('s:type:', '');
    else if (/house|home|villa|വീട്|1/i.test(bodyTrimmed)) ptype = 'house';
    else if (/plot|land|സ്ഥലം|2/i.test(bodyTrimmed)) ptype = 'plot';
    else if (/commercial|shop|office|കട|3/i.test(bodyTrimmed)) ptype = 'commercial';

    if (!ptype) {
      await askSellerType(from, conv.id, customerId); return;
    }
    await saveConversation(conv.id, { seller_data: { property_type: ptype }, workflow_status: 's_district' });
    await askDistrictQuick(from, conv.id, customerId, 's', 'Which district is the property located in? 📍');
    return;
  }

  if (status === 's_district') {
    // 1. "Other" quick-pick → show region picker
    if (bodyTrimmed === 's:reg:other' || /other/i.test(bodyTrimmed) || /മറ്റുള്ളവ/.test(bodyTrimmed)) {
      await askDistrictRegion(from, conv.id, customerId, 's', 'Which region is the property located in? 📍');
      return;
    }

    // 2. Region selection (from region picker: North, Central, South)
    let regKey: 'south' | 'central' | 'north' | null = null;
    if (bodyTrimmed.startsWith('s:reg:')) regKey = bodyTrimmed.replace('s:reg:', '') as any;
    else if (/north|വടക്ക്/i.test(bodyTrimmed)) regKey = 'north';
    else if (/central|മധ്യം/i.test(bodyTrimmed)) regKey = 'central';
    else if (/south|തെക്ക്/i.test(bodyTrimmed)) regKey = 'south';

    if (regKey && KERALA_REGIONS[regKey]) {
      await sendDistrictListForRegion(from, conv.id, customerId, 's', regKey);
      return;
    }

    // 3. District selection (quick-pick button or list or direct text entry)
    let district: string | null = null;
    if (bodyTrimmed.startsWith('s:district:')) {
      district = bodyTrimmed.replace('s:district:', '');
    } else {
      district = resolveDistrict(bodyTrimmed);
    }

    if (district) {
      await saveConversation(conv.id, { seller_data: { ...(conv.seller_data ?? {}), district }, workflow_status: 's_location' });
      await sendMsg(from, conv.id, customerId,
        `Great! You selected *${district}*.\n\nPlease type the town / area name and send it 📍`);
      return;
    }

    await askDistrictQuick(from, conv.id, customerId, 's', '⚠️ Please select your district:');
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
      let areaLabel = '';
      let numericVal: number | null = null;
      let unit = 'cent';

      if (bodyTrimmed === 's:detail:20cent' || bodyTrimmed === 's:detail:10cent' || /^upto\s*20/i.test(bodyTrimmed)) {
        areaLabel = 'Upto 20 cent';
        numericVal = 20;
      } else if (bodyTrimmed === 's:detail:50cent' || bodyTrimmed === 's:detail:25cent' || /^upto\s*50/i.test(bodyTrimmed)) {
        areaLabel = 'Upto 50 cent';
        numericVal = 50;
      } else if (bodyTrimmed === 's:detail:above50cent' || bodyTrimmed === 's:detail:big' || /more\s*than\s*50/i.test(bodyTrimmed) || /above\s*50/i.test(bodyTrimmed)) {
        areaLabel = 'More than 50 cent';
        numericVal = 50;
      } else if (bodyTrimmed.startsWith('s:detail:')) {
        areaLabel = bodyTrimmed.replace('s:detail:', '');
      } else if (bodyTrimmed) {
        areaLabel = bodyTrimmed;
        if (/acre/i.test(bodyTrimmed)) unit = 'acre';
      }

      if (!areaLabel) {
        await askSellerDetail(from, conv.id, customerId, ptype); return;
      }

      if (numericVal === null) {
        const match = areaLabel.match(/(\d+(?:\.\d+)?)/);
        numericVal = match ? parseFloat(match[1]) : null;
      }

      detail = areaLabel;
      await saveConversation(conv.id, {
        seller_data: {
          ...(conv.seller_data ?? {}),
          detail,
          land_area: numericVal ?? detail,
          land_area_unit: unit,
        },
        workflow_status: 's_price'
      });
      await sendMsg(from, conv.id, customerId,
        'What is your asking price?\n\n_(Reply with the amount in numbers, e.g. 2500000 for ₹25 Lakh)_');
      return;
    }

    const num = parseInt(bodyTrimmed, 10);
    if (isNaN(num) || num <= 0) {
      const hint = ptype === 'house'
        ? '⚠️ Please reply with the number of bedrooms (e.g. 2, 3, 4).'
        : '⚠️ Please reply with the number of rooms (e.g. 3, 5, 10).';
      await sendMsg(from, conv.id, customerId, hint); return;
    }
    detail = String(num);

    // For house and commercial: ask for land area
    await saveConversation(conv.id, {
      seller_data: { ...(conv.seller_data ?? {}), detail },
      workflow_status: 's_land_area'
    });
    await askSellerLandArea(from, conv.id, customerId);
    return;
  }

  if (status === 's_land_area') {
    let landArea: string | number = '';
    let landUnit = 'cent';

    if (bodyTrimmed === 's:land:20cent' || bodyTrimmed === 's:land:10cent' || /^upto\s*20/i.test(bodyTrimmed)) {
      landArea = 'Upto 20 cent';
      landUnit = 'cent';
    } else if (bodyTrimmed === 's:land:50cent' || bodyTrimmed === 's:land:25cent' || /^upto\s*50/i.test(bodyTrimmed)) {
      landArea = 'Upto 50 cent';
      landUnit = 'cent';
    } else if (bodyTrimmed === 's:land:above50cent' || bodyTrimmed === 's:land:big' || /more\s*than\s*50/i.test(bodyTrimmed) || /above\s*50/i.test(bodyTrimmed)) {
      landArea = 'More than 50 cent';
      landUnit = 'cent';
    } else if (bodyTrimmed) {
      landArea = bodyTrimmed;
      if (/acre/i.test(bodyTrimmed)) landUnit = 'acre';
      else landUnit = 'cent';
    }

    if (!landArea) {
      await askSellerLandArea(from, conv.id, customerId); return;
    }

    const numMatch = typeof landArea === 'string' ? landArea.match(/(\d+(?:\.\d+)?)/) : null;
    const numericArea = numMatch ? parseFloat(numMatch[1]) : (typeof landArea === 'number' ? landArea : null);

    await saveConversation(conv.id, {
      seller_data: {
        ...(conv.seller_data ?? {}),
        land_area: numericArea ?? landArea,
        land_area_unit: landUnit,
      },
      workflow_status: 's_price'
    });
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

        if (newCount >= 5) {
          const existing = photoBatchTimers.get(conv.id);
          if (existing) {
            clearTimeout(existing.timer);
            photoBatchTimers.delete(conv.id);
          }
          await finishSellerFlow(from, { ...conv, seller_data: { ...data, image_count: newCount } }, customerId, { ...data, image_count: newCount });
        } else {
          const hasMore = await hasPendingJobsForSender(from);
          if (hasMore) {
            console.log(`[Photo Batch] More messages pending in queue for ${from}, skipping intermediate notification.`);
          } else {
            schedulePhotoBatchNotification(from, conv, customerId, conv.pending_submission_id, newCount);
          }
        }
      } catch (err) {
        console.error('[Media upload error]', err);
        await sendMsg(from, conv.id, customerId, 'Sorry, error uploading your photo. Please try again.');
      }
      return;
    }

    if (['done', 'no photos', 'skip'].includes(bodyLower) || imageCount >= 5) {
      const existing = photoBatchTimers.get(conv.id);
      if (existing) {
        clearTimeout(existing.timer);
        photoBatchTimers.delete(conv.id);
      }
      let currentCount = imageCount;
      if (conv.pending_submission_id) {
        const { data: sub } = await db()
          .from('crm_seller_submissions')
          .select('image_paths')
          .eq('id', conv.pending_submission_id)
          .single();
        currentCount = ((sub?.image_paths as string[]) ?? []).length;
      }
      await finishSellerFlow(from, conv, customerId, { ...data, image_count: currentCount });
      return;
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
