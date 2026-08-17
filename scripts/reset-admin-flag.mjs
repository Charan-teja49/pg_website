// Clear `must_change_password` on every row in the `admins` table.
// Run this whenever you've added a new admin via the Staff page BEFORE the
// updated provision-admin function was redeployed — it makes sure they
// don't see the first-login change-password modal.
//
//   $env:SUPABASE_SERVICE_KEY = "ey..."
//   node scripts/reset-admin-flag.mjs

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://nedgpqnytcmfocjwocds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var required.');
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/admins?select=id,name,role,auth_user_id,username&auth_user_id=not.is.null`,
    { headers: H },
  );
  const admins = await r.json();
  if (!Array.isArray(admins) || admins.length === 0) {
    console.log('No admins with auth_user_id found.');
    return;
  }
  console.log(`Resetting must_change_password=false for ${admins.length} admin(s):\n`);

  for (const a of admins) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${a.auth_user_id}`,
      {
        method: 'PUT',
        headers: H,
        body: JSON.stringify({
          user_metadata: {
            must_change_password: false,
            name: a.name,
            role: a.role,
          },
        }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      console.log(`  FAIL ${a.username}: ${body.msg ?? body.error ?? JSON.stringify(body)}`);
      continue;
    }
    const meta = body.user_metadata ?? {};
    console.log(
      `  OK   ${(a.username ?? '').padEnd(30)} role=${(a.role ?? '').padEnd(14)} must_change=${meta.must_change_password}`,
    );
  }
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
