/**
 * S N Homes — WhatsApp CRM Server
 *
 * Official Meta Cloud API webhook receiver + REST API for the admin dashboard.
 * Runs on PORT (default 3001), proxied from Vite at /api.
 *
 * Environment variables (see .env.example):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
 *   META_APP_SECRET, GEMINI_API_KEY, WEBSITE_BASE_URL,
 *   OWNER_WHATSAPP_PHONE, OWNER_EMAIL, SENDGRID_API_KEY
 */
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getSupabase } from './supabaseAdmin';
import { enqueueMessage, startWorker } from './jobWorker';
import apiRouter from './apiRoutes';

// ─── Init Supabase admin (validates env vars on startup) ─────────────────────
getSupabase();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3001;

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── JSON body parser with rawBody capture for Meta HMAC verification ─────────
app.use(
  express.json({
    limit: '1mb',
    verify: (req: Request & { rawBody?: string }, _res: Response, buf: Buffer) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// ─── HMAC signature validator ─────────────────────────────────────────────────
function verifyHmac(req: Request & { rawBody?: string }): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // dev: skip if no secret configured
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature || !req.rawBody) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    whatsapp_configured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    ),
    ai_configured: Boolean(process.env.GEMINI_API_KEY),
    supabase_configured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    timestamp: new Date().toISOString(),
  });
});

// ─── WhatsApp webhook verification (GET) ─────────────────────────────────────
app.get('/api/webhooks/whatsapp', (req: Request, res: Response) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'my_verify_token')) {
    console.log('[Webhook] Meta verification challenge passed');
    res.status(200).send(challenge);
  } else {
    console.warn('[Webhook] Verification failed — token mismatch');
    res.sendStatus(403);
  }
});

// ─── WhatsApp webhook receiver (POST) ────────────────────────────────────────
app.post('/api/webhooks/whatsapp', async (req: Request & { rawBody?: string }, res: Response) => {
  // Acknowledge immediately (Meta requires 200 within 1 second)
  res.sendStatus(200);

  if (!verifyHmac(req)) {
    console.error('[Webhook] HMAC validation failed — ignoring message');
    return;
  }

  try {
    const body = JSON.parse(req.rawBody || '{}');
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value) return;

    // ── Handle delivery status updates ────────────────────────────────────────
    if (value.statuses) {
      for (const status of value.statuses as Array<{ id: string; status: string; timestamp: string }>) {
        console.log('[Status]', status.id, '->', status.status);
        try {
          await getSupabase()
            .from('crm_messages')
            .update({
              provider_status: status.status,
              status_updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', status.id);
        } catch (e) {
          console.error('[Status update error]', e);
        }
      }
      return;
    }

    // ── Handle inbound messages ───────────────────────────────────────────────
    const messages: unknown[] = value.messages || [];
    const contacts: unknown[] = value.contacts || [];

    const contactMap: Record<string, string> = {};
    for (const c of contacts as Array<{ wa_id: string; profile?: { name?: string } }>) {
      contactMap[c.wa_id] = c.profile?.name || '';
    }

    for (const rawMsg of messages as Array<Record<string, unknown>>) {
      const from = String(rawMsg['from'] || '');
      const providerId = String(rawMsg['id'] || '');
      const type = String(rawMsg['type'] || 'text');

      let msgBody = '';
      let mediaId: string | undefined;
      let mimeType: string | undefined;

      if (type === 'text') {
        msgBody = String((rawMsg['text'] as Record<string, string>)?.body || '');
      } else if (type === 'image' || type === 'document' || type === 'video') {
        const media = rawMsg[type] as Record<string, string> | undefined;
        mediaId = media?.id;
        mimeType = media?.mime_type;
        msgBody = (rawMsg['caption'] as string) || '';
      } else if (type === 'interactive') {
        const interactive = rawMsg['interactive'] as Record<string, Record<string, string>> | undefined;
        msgBody =
          interactive?.button_reply?.id ||
          interactive?.button_reply?.title ||
          interactive?.list_reply?.id ||
          interactive?.list_reply?.title ||
          '';
      } else if (type === 'button') {
        const btn = rawMsg['button'] as Record<string, string> | undefined;
        msgBody = btn?.payload || btn?.text || '';
      } else {
        console.log('[Webhook] Ignoring unsupported message type:', type);
        continue;
      }

      console.log('[Inbound] from=' + from + ' type=' + type + ' mediaId=' + (mediaId || 'none'));

      enqueueMessage({
        from,
        senderName: contactMap[from],
        body: msgBody,
        providerId,
        mediaId,
        mimeType,
      }).catch(err => console.error('[Enqueue error]', err));
    }
  } catch (err) {
    console.error('[Webhook parse error]', err);
  }
});

// ─── CRM REST API ─────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('[Server] S N Homes WhatsApp CRM running on port ' + PORT);
  console.log('[Server] Webhook URL: POST /api/webhooks/whatsapp');
  console.log('[Server] Health: GET  /api/health');
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.warn('[Server] WHATSAPP_ACCESS_TOKEN not set — outbound messages disabled');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Server] GEMINI_API_KEY not set — AI responses disabled');
  }
  startWorker();
});
