// Supabase Edge Function — provision a student's Supabase Auth user.
//
// Called by the admin app after `createStudent` succeeds. Uses the service
// role key (kept on the server) to:
//   1. Verify the caller is an authenticated admin.
//   2. Look up the student by id, get their mobile.
//   3. Create / reset an auth user with email `<mobile>@pg.local`, password
//      = welcome_password (default Pg@Welcome123), user_metadata.
//      must_change_password = true.
//   4. Link the auth user id back into students.auth_user_id.
//
// Idempotent — if an auth user with the email already exists, it's reset.
//
// Deploy:
//   supabase functions deploy provision-student --no-verify-jwt
// (we do JWT verification manually inside the handler.)
//
// Invoke from the app:
//   supabase.functions.invoke('provision-student', { body: { student_id: 42 } })

// @ts-expect-error - Deno standard library import resolved at deploy time
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
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  try {
    // @ts-expect-error - Deno global available in the function runtime
    const url = Deno.env.get('SUPABASE_URL')!;
    // @ts-expect-error
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // @ts-expect-error
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // -- 1. Verify caller is a real authenticated user
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } =
      await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid auth token' }, 401);
    }

    // -- 2. Check caller is an admin
    const admin = createClient(url, serviceKey);
    const { data: adminRow } = await admin
      .from('admins')
      .select('id, role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (!adminRow) {
      return json(
        { error: 'Caller is not an admin' },
        403,
      );
    }

    // -- 3. Read body
    const body = await req.json().catch(() => ({}));
    const studentId = Number(body.student_id);
    const welcomePwd = String(body.welcome_password ?? 'Pg@Welcome123');
    if (!studentId) {
      return json({ error: 'student_id is required' }, 400);
    }

    // -- 4. Load the student
    const { data: student, error: sErr } = await admin
      .from('students')
      .select('id, mobile, name, auth_user_id')
      .eq('id', studentId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!student) return json({ error: 'Student not found' }, 404);

    if (student.auth_user_id) {
      return json({
        ok: true,
        already_provisioned: true,
        auth_user_id: student.auth_user_id,
        email: `${student.mobile}@pg.local`,
      });
    }

    const email = `${student.mobile}@pg.local`;
    const meta = {
      must_change_password: true,
      mobile: student.mobile,
      name: student.name,
    };

    // -- 5. Create or reset the auth user
    let authUserId: string;

    // Try create first; if email already taken, look it up and reset password.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password: welcomePwd,
        email_confirm: true,
        user_metadata: meta,
      });

    if (createErr) {
      const msg = String(createErr.message ?? '').toLowerCase();
      const alreadyExists =
        // @ts-expect-error - status is on the error object at runtime
        createErr.status === 422 || /already|exist|registered/.test(msg);
      if (!alreadyExists) throw createErr;

      // fall back: find the existing user and reset password + meta
      const { data: list, error: listErr } =
        await admin.auth.admin.listUsers({ perPage: 500 });
      if (listErr) throw listErr;
      // @ts-expect-error
      const existing = list?.users?.find((u: any) => u.email === email);
      if (!existing) {
        return json(
          { error: 'Auth user exists for email but could not be found' },
          500,
        );
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { password: welcomePwd, user_metadata: meta },
      );
      if (updErr) throw updErr;
      authUserId = existing.id;
    } else {
      authUserId = created.user!.id;
    }

    // -- 6. Link back
    const { error: linkErr } = await admin
      .from('students')
      .update({ auth_user_id: authUserId })
      .eq('id', studentId);
    if (linkErr) throw linkErr;

    return json({
      ok: true,
      auth_user_id: authUserId,
      email,
      welcome_password: welcomePwd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
