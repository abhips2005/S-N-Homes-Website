/**
 * DEPRECATED — Firebase removed. This file is kept only as a compatibility shim
 * so that any remaining references (e.g. old test files) don't cause build errors.
 * All real server code now uses server/supabaseAdmin.ts instead.
 */
export { getSupabase as getDb, writeAudit } from './supabaseAdmin';
