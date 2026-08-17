import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing. ' +
      'Running with the local mock data layer. Add them to .env.local to enable Supabase.',
  );
}

// We export the client unconditionally so consumer code stays type-safe.
// When the env vars are missing it's still a valid client pointed at a
// dummy URL — every call will fail, which is fine for the mock-mode path
// where we never call it.
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Mobile + password login is mapped onto Supabase Auth via a synthetic
 * email so RLS policies can rely on `auth.uid()` without needing SMS OTP.
 *
 *   mobile = 9876543210  =>  9876543210@pg.local
 *
 * The same convention is used for both students and staff. The `users`
 * row in Supabase Auth carries `raw_user_meta_data.role` = 'student' |
 * 'super_admin' | 'building_staff'.
 */
export function mobileToAuthEmail(mobile: string): string {
  const cleaned = mobile.replace(/\D/g, '').slice(-10);
  return `${cleaned}@pg.local`;
}

/**
 * Wrap a Supabase / PostgREST error in a real Error so React error banners
 * show a readable message instead of "[object Object]".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pgError(e: any, context = 'Supabase error'): Error {
  if (e instanceof Error) return e;
  if (!e) return new Error(context);
  const message = e.message || e.error_description || JSON.stringify(e);
  const details = e.details ? ` — ${e.details}` : '';
  const hint = e.hint ? ` (hint: ${e.hint})` : '';
  const code = e.code ? ` [${e.code}]` : '';
  return new Error(`${context}: ${message}${details}${code}${hint}`);
}
