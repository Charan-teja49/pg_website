// Idempotent one-shot: ensures the `aadhaar` storage bucket exists with
// the right limits + MIME types. Run once with the service-role key.
//
//   $env:SUPABASE_SERVICE_KEY = "ey..."
//   node scripts/setup-storage.mjs

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
  'Content-Type': 'application/json',
};

async function main() {
  // 1. Does the bucket exist?
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: HEADERS,
  });
  const buckets = await listRes.json();
  const exists = (buckets ?? []).some((b) => b.id === 'aadhaar');

  if (exists) {
    console.log('✓ Bucket "aadhaar" already exists.');
  } else {
    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        id: 'aadhaar',
        name: 'aadhaar',
        public: true,
        file_size_limit: 5242880, // 5 MB
        allowed_mime_types: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
      }),
    });
    if (!createRes.ok) {
      console.error(
        `Failed to create bucket: ${createRes.status} ${await createRes.text()}`,
      );
      process.exit(2);
    }
    console.log('✓ Bucket "aadhaar" created.');
  }

  console.log(
    '\nNext step: paste `supabase/migrations/0007_storage_policies.sql` in\n' +
      'Supabase SQL Editor and run it. Without those policies, uploads fail with\n' +
      'RLS-violation errors.',
  );
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
