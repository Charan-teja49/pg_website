// Health-check: curls every important Supabase query the app makes and
// reports pass/fail. Run any time to verify backend is still wired right.
//
// Usage:
//   $env:SUPABASE_SERVICE_KEY = "ey..."
//   node scripts/health-check.mjs

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://nedgpqnytcmfocjwocds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var required.');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

const queries = [
  // Schema sanity
  ['buildings', '?select=count', 'count=exact'],
  ['units', '?select=count', 'count=exact'],
  ['beds', '?select=count', 'count=exact'],
  ['students', '?select=count', 'count=exact'],
  ['fee_structures', '?select=count', 'count=exact'],
  ['payments', '?select=count', 'count=exact'],
  ['complaints', '?select=count', 'count=exact'],
  ['announcements', '?select=count', 'count=exact'],
  ['food_menu', '?select=count', 'count=exact'],
  ['maintenance', '?select=count', 'count=exact'],
  ['room_change_requests', '?select=count', 'count=exact'],

  // App joins
  [
    'students',
    '?select=*,buildings(short_name),beds!students_bed_id_fkey(label,units(label,type)),fee_structures(payment_status,balance_amount)&limit=1',
  ],
  ['units', '?select=*,buildings(short_name),beds!inner(id)&limit=1'],
  [
    'beds',
    '?select=*,units!inner(building_id,label,type,buildings(short_name)),students!fk_beds_student(name)&limit=1',
  ],
  [
    'payments',
    '?select=*,students!inner(building_id,name,buildings(short_name))&limit=1',
  ],
  [
    'complaints',
    '?select=*,students!inner(name,building_id,buildings(short_name))&limit=1',
  ],
  ['announcements', '?select=*,buildings(short_name)&limit=1'],
  ['food_menu', '?select=*,buildings(short_name)&limit=1'],
  ['maintenance', '?select=*,buildings(short_name)&limit=1'],
  [
    'room_change_requests',
    '?select=*,students!inner(name,building_id,buildings(short_name))&limit=1',
  ],
];

async function main() {
  console.log(`Health check @ ${SUPABASE_URL}\n`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const [table, qs, extraPrefer] of queries) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${qs}`;
    const headers = { ...HEADERS };
    if (extraPrefer) headers['Prefer'] = extraPrefer;
    const res = await fetch(url, { headers });
    const ok2xx = res.status >= 200 && res.status < 300;
    const label = `${table.padEnd(22)} ${(qs ?? '').slice(0, 80).padEnd(80)} → ${res.status}`;
    if (ok2xx) {
      ok++;
      console.log(`  ✓ ${label}`);
    } else {
      fail++;
      const body = await res.text();
      failures.push({ table, qs, status: res.status, body: body.slice(0, 300) });
      console.log(`  ✗ ${label}`);
    }
  }

  // Auth count
  const u = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: HEADERS,
  });
  const j = await u.json();
  console.log(`\nAuth users: ${(j.users ?? []).length}`);

  console.log(`\nResult: ${ok} ok, ${fail} fail (${queries.length} queries)`);
  if (fail > 0) {
    console.log('\nFailures:');
    failures.forEach((f) =>
      console.log(`  ${f.table} (${f.status}) → ${f.body}`),
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
