// Supabase Edge Function — provision a building admin or super admin.
//
// Only callable by an existing super admin. Creates the Supabase Auth user
// with the supplied email + password, inserts a row into `admins`, links
// them, and returns success.
//
// Body:
//   {
//     name: string,
//     email: string,            // becomes their login
//     password: string,         // welcome password
//     role: 'super' | 'building_staff',
//     assigned_building_id?: number, // required when role = building_staff
//     mobile?: string,
//   }
//
// Deploy:
//   supabase functions deploy provision-admin --no-verify-jwt
// Or paste in Dashboard → Edge Functions, toggle Verify JWT OFF.

// @ts-expect-error - Deno std import resolved at deploy time
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error - esm.sh import resolved at deploy time
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
    // @ts-expect-error - Deno env in runtime
    const url = Deno.env.get('SUPABASE_URL')!;
    // @ts-expect-error
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // @ts-expect-error
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    // 1. Verify caller identity
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } =
      await callerClient.auth.getUser();
    if (userErr || !userData?.user)
      return json({ error: 'Invalid token' }, 401);

    // 2. Verify caller is a super admin
    const admin = createClient(url, serviceKey);
    const { data: callerAdmin } = await admin
      .from('admins')
      .select('id, role, is_active')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (!callerAdmin || callerAdmin.role !== 'super' || !callerAdmin.is_active) {
      return json({ error: 'Only super admins can provision admins' }, 403);
    }

    // 3. Parse body
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role = body.role === 'super' ? 'super' : 'building_staff';
    const assignedBuildingId =
      body.assigned_building_id != null
        ? Number(body.assigned_building_id)
        : null;
    const mobile = body.mobile ? String(body.mobile) : null;

    if (!name || !email || !password) {
      return json({ error: 'name, email, password are required' }, 400);
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }
    if (role === 'building_staff' && !assignedBuildingId) {
      return json(
        { error: 'assigned_building_id required for building_staff' },
        400,
      );
    }

    // 4. Create / reset auth user.
    // Admins do NOT get the force-change-on-first-login flag — the super
    // admin is the one setting their password, so it's intentional.
    let authUserId: string;
    const meta = {
      must_change_password: false,
      name,
      role,
    };

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: meta,
      });

    if (createErr) {
      const msg = String(createErr.message ?? '').toLowerCase();
      const alreadyExists =
        // @ts-expect-error - status at runtime
        createErr.status === 422 || /already|exist|registered/.test(msg);
      if (!alreadyExists) throw createErr;
      // existing user → reset their password + meta
      const { data: list, error: listErr } =
        await admin.auth.admin.listUsers({ perPage: 500 });
      if (listErr) throw listErr;
      // @ts-expect-error
      const existing = list?.users?.find((u: any) => u.email === email);
      if (!existing) {
        return json(
          { error: 'Auth user with that email exists but cannot be found' },
          500,
        );
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { password, user_metadata: meta },
      );
      if (updErr) throw updErr;
      authUserId = existing.id;
    } else {
      authUserId = created.user!.id;
    }

    // 5. Insert / update admins row
    // Use the email as the unique `username` so they can be referenced
    // later. Reuse if already linked.
    const { data: existingAdmin } = await admin
      .from('admins')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingAdmin) {
      const { error: updErr } = await admin
        .from('admins')
        .update({
          username: email,
          mobile,
          name,
          role,
          assigned_building_id: assignedBuildingId,
          is_active: true,
        })
        .eq('id', existingAdmin.id);
      if (updErr) throw updErr;
      return json({ ok: true, updated: true, admin_id: existingAdmin.id });
    }

    const { data: insertedAdmin, error: insErr } = await admin
      .from('admins')
      .insert({
        auth_user_id: authUserId,
        username: email,
        mobile,
        name,
        role,
        assigned_building_id: assignedBuildingId,
        is_active: true,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    return json({
      ok: true,
      created: true,
      admin_id: insertedAdmin.id,
      auth_user_id: authUserId,
      email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
