/**
 * MediaService — downloads WhatsApp media via the official Graph API
 * and uploads it to Supabase Storage (private bucket: seller-submissions).
 * Returns the storage path. Signed URLs are generated separately on demand.
 */
import { getSupabase } from './supabaseAdmin';

const WA_API_BASE = 'https://graph.facebook.com/v19.0';
const BUCKET = 'seller-submissions';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

async function getWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const res = await fetch(`${WA_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`WA media URL fetch failed: ${res.status}`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error('No URL in media response');
  return data.url;
}

async function downloadMedia(
  mediaUrl: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
  const mimeType = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

function extForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  return map[mime] || 'bin';
}

/**
 * Download media from WhatsApp and upload to Supabase Storage.
 * Returns storagePath (e.g. seller_submissions/abc/img.jpg).
 * NOTE: Does NOT return a signed URL — call getSignedImageUrls() for that.
 */
export async function downloadAndStoreMedia(
  mediaId: string,
  submissionId: string,
  accessToken: string
): Promise<{ storagePath: string }> {
  const mediaUrl = await getWhatsAppMediaUrl(mediaId, accessToken);
  const { buffer, mimeType } = await downloadMedia(mediaUrl, accessToken);

  if (!mimeType.startsWith('image/')) throw new Error(`Unsupported media type: ${mimeType}`);
  if (buffer.byteLength > 16 * 1024 * 1024) throw new Error('Image too large (> 16 MB)');

  const ext = extForMime(mimeType);
  const storagePath = `seller_submissions/${submissionId}/${mediaId}.${ext}`;

  const { error } = await getSupabase()
    .storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  console.log('[Media] Uploaded to Supabase Storage:', storagePath);
  return { storagePath };
}

/**
 * Generate temporary signed URLs for an array of storage paths.
 * Used when serving images to the admin dashboard.
 * @param paths  Array of storage paths stored in crm_seller_submissions.image_paths
 * @param ttlSeconds  Signed URL validity in seconds (default 1 hour)
 */
export async function getSignedImageUrls(
  paths: string[],
  ttlSeconds = SIGNED_URL_TTL_SECONDS
): Promise<string[]> {
  if (paths.length === 0) return [];

  const { data, error } = await getSupabase()
    .storage
    .from(BUCKET)
    .createSignedUrls(paths, ttlSeconds);

  if (error) {
    console.error('[Media] getSignedImageUrls error:', error.message);
    return [];
  }

  return (data ?? []).map(d => d.signedUrl ?? '').filter(Boolean);
}

/**
 * Delete all media files for a submission (used on rejection).
 */
export async function deleteSubmissionMedia(submissionId: string): Promise<void> {
  const prefix = `seller_submissions/${submissionId}/`;

  const { data: files, error: listErr } = await getSupabase()
    .storage
    .from(BUCKET)
    .list(`seller_submissions/${submissionId}`);

  if (listErr) {
    console.error('[Media] deleteSubmissionMedia list error:', listErr.message);
    return;
  }

  if (!files || files.length === 0) return;

  const paths = files.map(f => prefix + f.name);
  const { error: removeErr } = await getSupabase()
    .storage
    .from(BUCKET)
    .remove(paths);

  if (removeErr) console.error('[Media] deleteSubmissionMedia remove error:', removeErr.message);
  else console.log('[Media] Deleted', paths.length, 'files for submission', submissionId);
}
