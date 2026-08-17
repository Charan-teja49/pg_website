// Renumber beds in every unit so labels are 'Bed 1', 'Bed 2', ... in id-asc
// order. Run this if label gaps exist from older deletes (newer deletes
// renumber automatically via deleteBed).
//
//   $env:SUPABASE_SERVICE_KEY = "ey..."
//   node scripts/renumber-beds.mjs

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

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const units = await rest('units?select=id,label,type,building_id&order=id');
  console.log(`Scanning ${units.length} units…\n`);

  let renamed = 0;
  let scanned = 0;

  for (const u of units) {
    const beds = await rest(
      `beds?unit_id=eq.${u.id}&select=id,label&order=id.asc`,
    );
    if (!beds || beds.length === 0) continue;
    scanned++;

    let n = 1;
    const changes = [];
    for (const b of beds) {
      const expected = `Bed ${n}`;
      if (b.label !== expected) {
        changes.push({ id: b.id, from: b.label, to: expected });
      }
      n++;
    }
    if (changes.length === 0) continue;

    process.stdout.write(`  ${u.label} (${u.type}) — `);
    for (const c of changes) {
      await rest(`beds?id=eq.${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: c.to }),
      });
      renamed++;
    }
    console.log(`renamed ${changes.length} (${changes.map((c) => `${c.from}->${c.to}`).join(', ')})`);
  }

  console.log(
    `\nDone. ${scanned} units scanned, ${renamed} beds renamed.`,
  );
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
