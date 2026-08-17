// PG hostel management — one-shot bulk auth provisioning.
//
// For every row in `students` that has auth_user_id IS NULL, creates a
// Supabase Auth user with:
//   email    = <mobile>@pg.local
//   password = process.env.PG_WELCOME_PASSWORD || 'Pg@Welcome123'
//   metadata = { must_change_password: true, mobile, name }
// Then patches students.auth_user_id = <new_uuid>.
//
// Uses plain fetch — no @supabase/supabase-js (avoids Node 20 ws issue).
//
// Usage:
//   $env:SUPABASE_SERVICE_KEY = "ey..."   # service role key
//   node scripts/provision-auth.mjs

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://nedgpqnytcmfocjwocds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WELCOME_PWD = process.env.PG_WELCOME_PASSWORD ?? 'Pg@Welcome123';

if (!SERVICE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_KEY env var is required. See script header.',
  );
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`REST ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function admin(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`AUTH ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

async function listAllUsers() {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const r = await admin('GET', `users?page=${page}&per_page=200`);
    const users = r?.users ?? [];
    out.push(...users);
    if (users.length < 200) break;
  }
  return out;
}

async function main() {
  console.log(`Bulk auth provisioning @ ${SUPABASE_URL}`);
  console.log(`Welcome password: ${WELCOME_PWD}\n`);

  const students = await rest(
    'students?select=id,mobile,name,auth_user_id&auth_user_id=is.null',
  );
  if (!students || students.length === 0) {
    console.log('All students already have auth_user_id — nothing to do.');
    return;
  }
  console.log(`Need to provision ${students.length} student(s).\n`);

  // Index existing auth users by email so we know what already exists
  const existing = await listAllUsers();
  const byEmail = new Map(existing.map((u) => [u.email, u]));
  console.log(`(${existing.length} auth users already exist in the project.)\n`);

  let created = 0;
  let reset = 0;
  let linked = 0;
  const failures = [];

  for (const s of students) {
    const email = `${s.mobile}@pg.local`;
    process.stdout.write(`  • ${String(s.name).padEnd(28)} ${email.padEnd(28)} `);

    let authUserId = null;
    const meta = {
      must_change_password: true,
      mobile: s.mobile,
      name: s.name,
    };

    const existingUser = byEmail.get(email);
    try {
      if (existingUser) {
        // Reset their password + metadata
        await admin('PUT', `users/${existingUser.id}`, {
          password: WELCOME_PWD,
          user_metadata: meta,
        });
        authUserId = existingUser.id;
        reset++;
        process.stdout.write('reset_existing → ');
      } else {
        const r = await admin('POST', 'users', {
          email,
          password: WELCOME_PWD,
          email_confirm: true,
          user_metadata: meta,
        });
        authUserId = r?.id ?? null;
        if (!authUserId) throw new Error('no id in response');
        created++;
        process.stdout.write('created → ');
      }

      // Link in students table
      await rest(`students?id=eq.${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ auth_user_id: authUserId }),
      });
      linked++;
      console.log('linked');
    } catch (e) {
      console.log('FAIL', e.message);
      failures.push({ id: s.id, mobile: s.mobile, error: e.message });
    }
  }

  console.log(
    `\nDone. created=${created} reset_existing=${reset} linked=${linked} failures=${failures.length}`,
  );
  if (failures.length > 0) {
    console.log('Failures:', JSON.stringify(failures, null, 2));
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
