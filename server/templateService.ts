/**
 * WhatsApp Template Message Service
 *
 * Sends pre-approved Meta message templates for outbound messages initiated
 * OUTSIDE the 24-hour customer service window. Uses Supabase for audit logging.
 *
 * Required templates (register in Meta Business Manager):
 *   Template name           | Category  | Variables
 *   sn_property_followup    | UTILITY   | {{1}} = buyer first name, {{2}} = property count
 *   sn_seller_approved      | UTILITY   | {{1}} = seller first name, {{2}} = property title
 *   sn_seller_rejected      | UTILITY   | {{1}} = seller first name, {{2}} = rejection reason
 *   sn_visit_confirmation   | UTILITY   | {{1}} = customer name, {{2}} = date, {{3}} = time
 *   sn_new_match_alert      | MARKETING | {{1}} = buyer first name, {{2}} = property URL
 */

import { getSupabase } from './supabaseAdmin';

const WA_API_BASE = 'https://graph.facebook.com/v26.0';

export const WaTemplate = {
  PropertyFollowUp:  'sn_property_followup',
  SellerApproved:    'sn_seller_approved',
  SellerRejected:    'sn_seller_rejected',
  VisitConfirmation: 'sn_visit_confirmation',
  NewMatchAlert:     'sn_new_match_alert',
} as const;

export type WaTemplateName = typeof WaTemplate[keyof typeof WaTemplate];

interface TemplateComponent {
  type: 'body';
  parameters: Array<{ type: 'text'; text: string }>;
}

/**
 * Send a pre-approved WhatsApp template message.
 * Returns the wamid (provider message ID) or null on failure.
 */
export async function sendTemplateMessage(
  to: string,
  templateName: WaTemplateName,
  variables: string[],
  languageCode = 'en',
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';

  if (!phoneNumberId || !token) {
    console.warn('[Template] Missing WA credentials — skipping template send to', to);
    return null;
  }

  const component: TemplateComponent = {
    type: 'body',
    parameters: variables.map(text => ({ type: 'text', text })),
  };

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: variables.length > 0 ? [component] : [],
    },
  };

  try {
    const res = await fetch(WA_API_BASE + '/' + phoneNumberId + '/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[Template] Send error (' + templateName + '):', await res.text());
      return null;
    }

    const data = await res.json() as { messages?: Array<{ id?: string }> };
    const wamid = data.messages?.[0]?.id ?? null;

    // Persist to audit log in Supabase
    await getSupabase().from('crm_template_messages').insert({
      to_phone: to,
      template_name: templateName,
      variables,
      language_code: languageCode,
      wamid,
      status: 'sent',
      created_at: new Date().toISOString(),
    });

    console.log('[Template] Sent', templateName, 'to', to, 'wamid:', wamid);
    return wamid;
  } catch (err) {
    console.error('[Template] Unexpected error:', err);
    return null;
  }
}

/**
 * Determine whether the 24-hour customer service window is still open.
 * Checks the most recent inbound message for a phone number.
 */
export async function isWithin24hWindow(customerPhone: string): Promise<boolean> {
  try {
    // Find the customer by phone
    const { data: customer } = await getSupabase()
      .from('crm_customers')
      .select('id')
      .eq('phone_e164', customerPhone)
      .maybeSingle();

    if (!customer) return false;

    // Find the most recent inbound message for this customer
    const { data: messages } = await getSupabase()
      .from('crm_messages')
      .select('created_at')
      .eq('customer_id', customer.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!messages || messages.length === 0) return false;

    const lastAt = new Date(messages[0].created_at as string).getTime();
    return Date.now() - lastAt < 24 * 60 * 60 * 1000;
  } catch {
    return false; // Safe default: assume window closed to avoid API rejection
  }
}

/**
 * Smart send: use freeform if within 24h window, otherwise use template fallback.
 */
export async function smartSend(
  to: string,
  freeformText: string,
  templateFallback: { name: WaTemplateName; variables: string[]; language?: string } | null,
  sendFreeform: (to: string, text: string) => Promise<string | null>,
): Promise<string | null> {
  const inWindow = await isWithin24hWindow(to);

  if (inWindow) return sendFreeform(to, freeformText);

  if (!templateFallback) {
    console.warn('[smartSend] Outside 24h window and no template fallback for', to);
    return null;
  }

  return sendTemplateMessage(
    to,
    templateFallback.name,
    templateFallback.variables,
    templateFallback.language ?? 'en',
  );
}
