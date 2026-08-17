// Supabase Edge Function — super-admin-only password reset for staff/admins.
//
// Body: { admin_id: number, new_password: string }
//
// Verifies caller is a super admin. Looks up the target admin's auth_user_id
// and resets the password via the Auth Admin API. Does NOT toggle the
// must_change_password flag (admins don't see the change-password modal).
//
// Deploy:
//   supabase functions deploy reset-admin-password --no-verify-jwt
// Or paste in Dashboard → Edge Functions, Verify JWT OFF.

// @ts-expect-error
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    // @ts-expect-error
    const url = Deno.env.get('SUPABASE_URL')!;
    // @ts-expect-error
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // @ts-expect-error
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    // Verify the caller's session.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user)
      return json({ error: 'Invalid token' }, 401);

    // Caller must be a super admin.
    const admin = createClient(url, serviceKey);
    const { data: callerAdmin } = await admin
      .from('admins')
      .select('id, role, is_active')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (
      !callerAdmin ||
      callerAdmin.role !== 'super' ||
      !callerAdmin.is_active
    ) {
      return json({ error: 'Only super admins can reset admin passwords' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const adminId = Number(body.admin_id);
    const newPassword = String(body.new_password ?? '');
    if (!adminId) return json({ error: 'admin_id required' }, 400);
    if (newPassword.length < 8)
      return json({ error: 'Password must be at least 8 characters' }, 400);

    // Look up the target admin row.
    const { data: target, error: tErr } = await admin
      .from('admins')
      .select('id, auth_user_id, username, name, role')
      .eq('id', adminId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target || !target.auth_user_id)
      return json({ error: 'Target admin not found or unlinked' }, 404);

    // Reset password via Auth Admin API. Keep must_change_password=false.
    const { error: updErr } = await admin.auth.admin.updateUserById(
      target.auth_user_id,
      {
        password: newPassword,
        user_metadata: {
          must_change_password: false,
          name: target.name,
          role: target.role,
        },
      },
    );
    if (updErr) throw updErr;

    return json({
      ok: true,
      admin_id: target.id,
      username: target.username,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
