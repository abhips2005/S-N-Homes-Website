/**
 * Durable Job Queue Worker
 * Polls crm_job_queue, locks jobs, processes with exponential backoff retries.
 * Uses Supabase PostgreSQL instead of Firestore.
 */
import { getSupabase } from './supabaseAdmin';
import { processMessage, InboundMessage } from './conversationEngine';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 4000;
const LOCK_TTL_MS = 60_000; // 1 minute

type JobStatus = 'pending' | 'locked' | 'completed' | 'failed' | 'dead';

interface Job {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  available_at: string;
  locked_at?: string;
  completed_at?: string;
  last_error?: string;
  created_at: string;
}

function db() { return getSupabase(); }

/** Exponential backoff: 30s, 2m, 8m, 32m, 2h */
function backoffSeconds(attempt: number): number {
  return Math.min(30 * Math.pow(4, attempt - 1), 7200);
}

async function pickJob(): Promise<Job | null> {
  const now = new Date().toISOString();

  // Select one pending job that is ready to run
  const { data: jobs, error } = await db()
    .from('crm_job_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .limit(1);

  if (error || !jobs || jobs.length === 0) return null;

  const job = jobs[0] as Job;

  // Optimistic lock — update to locked
  const { error: lockErr } = await db()
    .from('crm_job_queue')
    .update({ status: 'locked', locked_at: now })
    .eq('id', job.id)
    .eq('status', 'pending'); // guard against concurrent workers

  if (lockErr) {
    console.warn('[Worker] Failed to acquire lock on job', job.id);
    return null;
  }

  return job;
}

async function releaseStuckLocks(): Promise<void> {
  const cutoff = new Date(Date.now() - LOCK_TTL_MS).toISOString();
  const { error } = await db()
    .from('crm_job_queue')
    .update({ status: 'pending', locked_at: null })
    .eq('status', 'locked')
    .lt('locked_at', cutoff);
  if (error) console.error('[Worker] releaseStuckLocks error:', error.message);
}

async function processJob(job: Job): Promise<void> {
  try {
    if (job.job_type === 'process_message') {
      const msg = job.payload['msg'] as InboundMessage;
      await processMessage(msg);
    } else {
      console.warn('[Worker] Unknown job type:', job.job_type);
    }

    await db().from('crm_job_queue').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_error: null,
    }).eq('id', job.id);

    console.log('[Worker] Job completed:', job.id, job.job_type);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const nextAttempt = (job.attempts || 0) + 1;
    const isDead = nextAttempt >= MAX_ATTEMPTS;
    const backoffSec = backoffSeconds(nextAttempt);
    const availableAt = new Date(Date.now() + backoffSec * 1000).toISOString();

    console.error('[Worker] Job failed:', job.id, errMsg, 'attempt', nextAttempt);

    await db().from('crm_job_queue').update({
      status: isDead ? 'dead' : 'pending',
      attempts: nextAttempt,
      last_error: errMsg,
      locked_at: null,
      available_at: isDead ? job.available_at : availableAt,
    }).eq('id', job.id);

    if (isDead) {
      await db().from('crm_notifications').insert({
        subject: 'Worker Job Failed Permanently',
        body: `Job ${job.id} (${job.job_type}) failed after ${MAX_ATTEMPTS} attempts. Last error: ${errMsg}`,
        read: false,
        created_at: new Date().toISOString(),
      });
    }
  }
}

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await releaseStuckLocks();
    const job = await pickJob();
    if (job) await processJob(job);
  } catch (err) {
    console.error('[Worker] Tick error:', err);
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  console.log('[Worker] Starting job queue worker, polling every', POLL_INTERVAL_MS / 1000, 's');
  setInterval(tick, POLL_INTERVAL_MS);
  tick();
}

/** Enqueue a message-processing job */
export async function enqueueMessage(msg: InboundMessage): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('crm_job_queue')
    .insert({
      job_type: 'process_message',
      payload: { msg },
      status: 'pending',
      attempts: 0,
      available_at: now,
      locked_at: null,
      completed_at: null,
      last_error: null,
      created_at: now,
    })
    .select('id')
    .single();

  if (error) throw new Error('[Worker] Failed to enqueue job: ' + error.message);
  return data.id as string;
}
