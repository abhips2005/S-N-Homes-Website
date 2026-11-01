/**
 * CRM REST API routes — all endpoints required by the frontend admin pages.
 * Mounted at /api/v1 in whatsapp-server.ts.
 * Uses Supabase PostgreSQL (service role) instead of Firestore.
 */
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getSupabase, writeAudit } from './supabaseAdmin';
import { sendWhatsAppMessage } from './conversationEngine';
import { deleteSubmissionMedia, getSignedImageUrls } from './mediaService';

const router = Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many write requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function db() { return getSupabase(); }
function ok(res: Response, data: unknown) { res.json({ ok: true, data }); }
function err(res: Response, status: number, message: string) {
  res.status(status).json({ ok: false, error: message });
}

// ─── Conversations ────────────────────────────────────────────────────────────

router.get('/conversations', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const status = req.query.status as string | undefined;
    const paused = req.query.paused as string | undefined;

    let q = db()
      .from('crm_conversations')
      .select(`
        *,
        customer:crm_customers(id, phone_e164, name)
      `)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('workflow_status', status);
    if (paused !== undefined) q = q.eq('automation_paused', paused === 'true');

    const { data, error } = await q;
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.get('/conversations/:id/messages', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data, error } = await db()
      .from('crm_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/conversations/:id/reply', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { to, message } = req.body as { to: string; message: string };
    if (!to || !message?.trim()) return err(res, 400, 'to and message are required');

    const { data: conv, error: convErr } = await db()
      .from('crm_conversations')
      .select('customer_id')
      .eq('id', id)
      .single();
    if (convErr || !conv) return err(res, 404, 'Conversation not found');

    await sendWhatsAppMessage(to, message.trim());
    await db().from('crm_messages').insert({
      conversation_id: id,
      customer_id: conv.customer_id,
      direction: 'outbound',
      message_type: 'text',
      body: message.trim(),
      provider_status: 'sent',
      created_at: new Date().toISOString(),
    });

    await writeAudit('manual_reply', 'crm_conversations', id, 'admin', { to, length: message.length });
    ok(res, { sent: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/conversations/:id/pause', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await db()
      .from('crm_conversations')
      .update({ automation_paused: true })
      .eq('id', id);
    if (error) return err(res, 500, error.message);
    await writeAudit('bot_paused', 'crm_conversations', id, 'admin');
    ok(res, { paused: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/conversations/:id/resume', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await db()
      .from('crm_conversations')
      .update({ automation_paused: false })
      .eq('id', id);
    if (error) return err(res, 500, error.message);
    await writeAudit('bot_resumed', 'crm_conversations', id, 'admin');
    ok(res, { paused: false });
  } catch (e) { err(res, 500, String(e)); }
});

router.patch('/conversations/:id', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowed = ['automation_paused', 'notes', 'assigned_to', 'workflow_status'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return err(res, 400, 'No valid fields to update');
    const { error } = await db().from('crm_conversations').update(updates).eq('id', id);
    if (error) return err(res, 500, error.message);
    ok(res, { updated: true });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Buyer requests ───────────────────────────────────────────────────────────

router.get('/buyer-requests', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const status = req.query.status as string | undefined;

    let q = db()
      .from('crm_buyer_requests')
      .select(`*, customer:crm_customers(id, phone_e164, name)`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.get('/buyer-requests/:id', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data: buyerReq, error } = await db()
      .from('crm_buyer_requests')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !buyerReq) return err(res, 404, 'Buyer request not found');

    const { data: matches } = await db()
      .from('crm_property_matches')
      .select('*')
      .eq('conversation_id', buyerReq.conversation_id)
      .order('sent_at', { ascending: false })
      .limit(20);

    ok(res, { ...buyerReq, matches: matches ?? [] });
  } catch (e) { err(res, 500, String(e)); }
});

router.patch('/buyer-requests/:id', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowed = ['status', 'notes', 'assigned_to'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return err(res, 400, 'No valid fields to update');
    updates.updated_at = new Date().toISOString();
    const { error } = await db().from('crm_buyer_requests').update(updates).eq('id', id);
    if (error) return err(res, 500, error.message);
    await writeAudit('buyer_request_updated', 'crm_buyer_requests', id, 'admin', updates);
    ok(res, { updated: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.get('/buyer-requests/:id/matches', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('crm_property_matches')
      .select('*')
      .eq('buyer_request_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/buyer-requests/:id/matches', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { data: buyerReq, error: brErr } = await db()
      .from('crm_buyer_requests')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (brErr || !buyerReq) return err(res, 404, 'Buyer request not found');

    const reqs = (buyerReq.requirements ?? {}) as Record<string, unknown>;
    let q = db()
      .from('properties')
      .select('id, title, location, price')
      .in('status', ['active', 'available']);

    if (reqs.property_type) q = q.eq('property_type', reqs.property_type as string);
    if (reqs.budget_max) q = q.lte('price', reqs.budget_max as number);

    const { data: props } = await q.limit(20);
    const baseUrl = process.env.WEBSITE_BASE_URL || 'https://snhomes.in';
    const results = (props ?? []).slice(0, 5).map(p => ({
      conversation_id: buyerReq.conversation_id,
      buyer_request_id: req.params.id,
      property_id: p.id,
      property_title: String(p.title ?? 'Property'),
      property_url: baseUrl + '/property/' + p.id,
      match_score: 1,
      sent_at: null,
      created_at: new Date().toISOString(),
    }));

    if (results.length > 0) {
      await db().from('crm_property_matches').insert(results);
    }
    await db().from('crm_buyer_requests')
      .update({ status: 'matching', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    await writeAudit('buyer_rematch', 'crm_buyer_requests', req.params.id, 'admin', { count: results.length });
    ok(res, { matched: results.length, properties: results });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Seller submissions ───────────────────────────────────────────────────────

router.get('/seller-submissions', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const status = req.query.status as string | undefined;

    let q = db()
      .from('crm_seller_submissions')
      .select(`*, customer:crm_customers(id, phone_e164, name)`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('approval_status', status);
    const { data, error } = await q;
    if (error) return err(res, 500, error.message);

    // Enrich with fresh signed URLs for image_paths
    const enriched = await Promise.all((data ?? []).map(async (sub) => {
      const signedUrls = sub.image_paths?.length > 0
        ? await getSignedImageUrls(sub.image_paths as string[])
        : [];
      return { ...sub, signed_image_urls: signedUrls };
    }));

    ok(res, enriched);
  } catch (e) { err(res, 500, String(e)); }
});

router.get('/seller-submissions/:id', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('crm_seller_submissions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return err(res, 404, 'Seller submission not found');

    const signedUrls = data.image_paths?.length > 0
      ? await getSignedImageUrls(data.image_paths as string[])
      : [];

    ok(res, { ...data, signed_image_urls: signedUrls });
  } catch (e) { err(res, 500, String(e)); }
});

router.patch('/seller-submissions/:id', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowed = ['review_notes', 'details'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return err(res, 400, 'No valid fields to update');
    updates.updated_at = new Date().toISOString();
    const { error } = await db().from('crm_seller_submissions').update(updates).eq('id', id);
    if (error) return err(res, 500, error.message);
    ok(res, { updated: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/seller-submissions/:id/approve', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewer_id, review_notes } = req.body as { reviewer_id: string; review_notes?: string };

    const { data: sub, error: subErr } = await db()
      .from('crm_seller_submissions')
      .select('*, customer:crm_customers(phone_e164)')
      .eq('id', id)
      .single();
    if (subErr || !sub) return err(res, 404, 'Submission not found');

    await db().from('crm_seller_submissions').update({
      approval_status: 'approved',
      reviewer_id,
      review_notes: review_notes || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    const phone = (sub.customer as { phone_e164?: string })?.phone_e164;
    if (phone) {
      await sendWhatsAppMessage(
        phone,
        'Great news! Your property submission has been approved by S&N Homes. ' +
        'We will list it on our website shortly and contact you with next steps.'
      );
    }

    await writeAudit('submission_approved', 'crm_seller_submissions', id, reviewer_id, { review_notes });
    ok(res, { approved: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/seller-submissions/:id/reject', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewer_id, review_notes } = req.body as { reviewer_id: string; review_notes: string };
    if (!review_notes?.trim()) return err(res, 400, 'review_notes required for rejection');

    const { data: sub, error: subErr } = await db()
      .from('crm_seller_submissions')
      .select('*, customer:crm_customers(phone_e164)')
      .eq('id', id)
      .single();
    if (subErr || !sub) return err(res, 404, 'Submission not found');

    await db().from('crm_seller_submissions').update({
      approval_status: 'rejected',
      reviewer_id,
      review_notes,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    const phone = (sub.customer as { phone_e164?: string })?.phone_e164;
    if (phone) {
      await sendWhatsAppMessage(
        phone,
        `We reviewed your property submission. Unfortunately, we are unable to list it at this time. ` +
        `Reason: ${review_notes}. Please contact us if you have questions.`
      );
    }

    await deleteSubmissionMedia(id).catch(() => null);
    await writeAudit('submission_rejected', 'crm_seller_submissions', id, reviewer_id, { review_notes });
    ok(res, { rejected: true });
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/seller-submissions/:id/request-info', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body as { review_notes: string };
    if (!review_notes?.trim()) return err(res, 400, 'review_notes required');

    const { data: sub, error: subErr } = await db()
      .from('crm_seller_submissions')
      .select('*, customer:crm_customers(phone_e164)')
      .eq('id', id)
      .single();
    if (subErr || !sub) return err(res, 404, 'Submission not found');

    await db().from('crm_seller_submissions').update({
      approval_status: 'needs_more_information',
      review_notes,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    const phone = (sub.customer as { phone_e164?: string })?.phone_e164;
    if (phone) {
      await sendWhatsAppMessage(
        phone,
        `We need a bit more information about your property: ${review_notes}. Please reply with the details.`
      );
    }
    ok(res, { updated: true });
  } catch (e) { err(res, 500, String(e)); }
});

/**
 * Publish an approved submission as a real property listing.
 */
router.post('/seller-submissions/:id/publish', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: sub, error: subErr } = await db()
      .from('crm_seller_submissions')
      .select('*, customer:crm_customers(phone_e164)')
      .eq('id', id)
      .single();
    if (subErr || !sub) return err(res, 404, 'Submission not found');
    if (sub.approval_status !== 'approved') return err(res, 400, 'Submission must be approved before publishing');
    if (sub.property_id) return err(res, 409, 'Already published');

    const d = (sub.details ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();

    // Generate fresh signed URLs for images
    const signedUrls = sub.image_paths?.length > 0
      ? await getSignedImageUrls(sub.image_paths as string[])
      : [];

    // Create property listing
    const { data: propDoc, error: propErr } = await db()
      .from('properties')
      .insert({
        title: `${d.property_type ? String(d.property_type).charAt(0).toUpperCase() + String(d.property_type).slice(1) : 'Property'} in ${d.location || 'Kerala'}`,
        property_type: d.property_type || 'house',
        status: 'available',
        price: d.asking_price || 0,
        location: d.location || '',
        district: d.location || '',
        bedrooms: d.bedrooms || null,
        bathrooms: d.bathrooms || null,
        land_area: d.land_area || null,
        land_area_unit: d.land_area_unit || 'cent',
        area: d.built_up_area || null,
        description: d.description || '',
        images: signedUrls,
        source: 'whatsapp_crm',
        seller_submission_id: id,
        customer_id: sub.customer_id,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (propErr) return err(res, 500, 'Failed to create property: ' + propErr.message);

    // Link back to submission
    await db().from('crm_seller_submissions').update({
      property_id: propDoc.id,
      approval_status: 'converted_to_listing',
      updated_at: now,
    }).eq('id', id);

    const phone = (sub.customer as { phone_e164?: string })?.phone_e164;
    const baseUrl = process.env.WEBSITE_BASE_URL || 'https://snhomes.in';
    if (phone) {
      await sendWhatsAppMessage(
        phone,
        `Your property is now live on S&N Homes! View it here: ${baseUrl}/property/${propDoc.id}\n` +
        'We will notify you when interested buyers contact us.'
      );
    }

    await writeAudit('submission_published', 'crm_seller_submissions', id, 'admin', { property_id: propDoc.id });
    ok(res, { property_id: propDoc.id, url: `${baseUrl}/property/${propDoc.id}` });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Follow-ups ───────────────────────────────────────────────────────────────

router.get('/follow-ups', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const overdue = req.query.overdue as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    let q = db()
      .from('crm_follow_up_tasks')
      .select(`*, customer:crm_customers(id, phone_e164, name)`)
      .order('due_at', { ascending: true })
      .limit(limit);

    if (status) q = q.eq('status', status);
    if (overdue === 'true') q = q.lt('due_at', new Date().toISOString()).eq('status', 'pending');

    const { data, error } = await q;
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/follow-ups', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { customer_id, task_type, due_at, notes, conversation_id } = req.body as Record<string, string>;
    if (!task_type || !due_at) return err(res, 400, 'task_type and due_at required');
    const { data, error } = await db()
      .from('crm_follow_up_tasks')
      .insert({
        customer_id: customer_id || null,
        conversation_id: conversation_id || null,
        task_type,
        due_at,
        notes: notes || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) return err(res, 500, error.message);
    ok(res, { id: data.id });
  } catch (e) { err(res, 500, String(e)); }
});

router.patch('/follow-ups/:id', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, due_at } = req.body as Record<string, string>;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (notes) updates.notes = notes;
    if (due_at) updates.due_at = due_at;
    if (status === 'done') updates.completed_at = new Date().toISOString();
    const { error } = await db().from('crm_follow_up_tasks').update(updates).eq('id', id);
    if (error) return err(res, 500, error.message);
    ok(res, { updated: true });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Dashboard summary ────────────────────────────────────────────────────────

router.get('/dashboard/summary', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      { count: newBuyers },
      { count: pendingSellers },
      { count: activeConvs },
      { count: pausedConvs },
      { count: dueToday },
      { count: failedJobs },
    ] = await Promise.all([
      db().from('crm_buyer_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      db().from('crm_seller_submissions').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_review'),
      db().from('crm_conversations').select('*', { count: 'exact', head: true }).not('workflow_status', 'in', '(won,lost,seller_submitted)'),
      db().from('crm_conversations').select('*', { count: 'exact', head: true }).eq('automation_paused', true),
      db().from('crm_follow_up_tasks').select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('due_at', today.toISOString())
        .lt('due_at', tomorrow.toISOString()),
      db().from('crm_job_queue').select('*', { count: 'exact', head: true }).eq('status', 'dead'),
    ]);

    ok(res, {
      new_buyer_requests: newBuyers ?? 0,
      pending_seller_submissions: pendingSellers ?? 0,
      active_conversations: activeConvs ?? 0,
      conversations_needing_attention: pausedConvs ?? 0,
      follow_ups_due_today: dueToday ?? 0,
      failed_jobs: failedJobs ?? 0,
    });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/notifications', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('crm_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/notifications/:id/read', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { error } = await db()
      .from('crm_notifications')
      .update({ read: true })
      .eq('id', req.params.id);
    if (error) return err(res, 500, error.message);
    ok(res, { read: true });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Audit logs ───────────────────────────────────────────────────────────────

router.get('/audit-logs', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const entity = req.query.entity as string | undefined;

    let q = db()
      .from('crm_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entity) q = q.eq('entity', entity);
    const { data, error } = await q;
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Properties CRUD ──────────────────────────────────────────────────────────

router.get('/properties', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { status, limit: lim } = req.query;
    const maxLimit = Math.min(Number(lim) || 50, 200);
    let q = db()
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(maxLimit);
    if (status) q = q.eq('status', status as string);
    const { data, error } = await q;
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

router.get('/properties/:id', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('properties')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return err(res, 404, 'Property not found');
    ok(res, data);
  } catch (e) { err(res, 500, String(e)); }
});

router.post('/properties', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { title, property_type, propertyType, price, location, status = 'draft', ...rest } = req.body;
    const pType = property_type || propertyType;
    if (!title || !pType) return err(res, 400, 'title and property_type are required');
    const now = new Date().toISOString();
    const { data, error } = await db()
      .from('properties')
      .insert({
        title,
        property_type: pType,
        price: price ?? null,
        location: location ?? null,
        status,
        ...rest,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (error) return err(res, 500, error.message);
    await writeAudit('property_created', 'properties', data.id, 'admin');
    ok(res, { id: data.id });
  } catch (e) { err(res, 500, String(e)); }
});

router.patch('/properties/:id', strictLimiter, async (req: Request, res: Response) => {
  try {
    const allowed = ['title', 'property_type', 'price', 'location', 'status',
      'bedrooms', 'bathrooms', 'land_area', 'area', 'description', 'images', 'district'];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    const { error } = await db().from('properties').update(update).eq('id', req.params.id);
    if (error) return err(res, 500, error.message);
    await writeAudit('property_updated', 'properties', req.params.id, 'admin', { fields: Object.keys(update) });
    ok(res, { id: req.params.id });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers', defaultLimiter, async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('crm_customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return err(res, 500, error.message);
    ok(res, data ?? []);
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Signed upload URL for direct browser uploads ─────────────────────────────

router.post('/media/upload-url', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { filename, mimeType, submissionId } = req.body as { filename: string; mimeType: string; submissionId: string };
    if (!filename || !mimeType || !submissionId) return err(res, 400, 'filename, mimeType, submissionId required');

    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!ALLOWED_MIME.includes(mimeType)) return err(res, 400, 'Unsupported file type');

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `seller_submissions/${submissionId}/${Date.now()}_${safeName}`;

    const { data, error } = await db().storage
      .from('seller-submissions')
      .createSignedUploadUrl(storagePath);

    if (error) return err(res, 500, 'Failed to create signed URL: ' + error.message);

    ok(res, { uploadUrl: data.signedUrl, storagePath, token: data.token });
  } catch (e) { err(res, 500, String(e)); }
});

// ─── Admin: create a user (service role required — browser cannot do this) ────

router.post('/admin/users', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, role } = req.body as {
      name: string; email: string; phone: string; password: string; role: string;
    };
    if (!name || !email || !password) return err(res, 400, 'name, email, password required');

    const validRoles = ['user', 'agent', 'admin'];
    if (role && !validRoles.includes(role)) return err(res, 400, 'Invalid role');

    // Use Supabase Admin API (service role) to create the auth user
    const { data: authData, error: authErr } = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr) return err(res, 400, authErr.message);
    const userId = authData.user.id;

    // Insert profile row
    const now = new Date().toISOString();
    const { error: profileErr } = await db().from('users').insert({
      id: userId,
      name,
      email,
      phone: phone || null,
      role: role || 'user',
      verified: true,
      saved_properties: [],
      viewing_history: [],
      created_at: now,
      updated_at: now,
    });

    if (profileErr) {
      // Rollback auth user if profile insert fails
      await db().auth.admin.deleteUser(userId).catch(() => null);
      return err(res, 500, profileErr.message);
    }

    await writeAudit('user_created', 'users', userId, 'admin', { email, role });
    ok(res, { id: userId });
  } catch (e) { err(res, 500, String(e)); }
});

export default router;

