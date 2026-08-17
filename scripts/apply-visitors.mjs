// Check whether the `visitors` table exists in the configured Supabase
// project. The Supabase data-plane (PostgREST) does not allow arbitrary
// `CREATE TABLE` from a script, so this is a check-and-instruct helper:
//   - if the table exists, we say so and exit 0.
//   - if it does not, we print clear "paste this SQL into the editor"
//     instructions and exit 0 too (the app handles the missing table
//     gracefully — see src/app/data/visitors.ts).
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_KEY = "ey..."
//   node scripts/apply-visitors.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://nedgpqnytcmfocjwocds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var required.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '0005_visitor_log.sql',
);

async function tableExists() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/visitors?select=id&limit=1`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (res.status >= 200 && res.status < 300) return true;
  // PostgREST returns 404 + code "PGRST205" when the table is missing.
  if (res.status === 404) return false;
  // Anything else is unexpected — surface it but treat as "not present"
  // so the caller still sees the paste-and-run instructions.
  const body = await res.text();
  console.warn(
    `[apply-visitors] Unexpected response ${res.status} when probing: ${body.slice(0, 200)}`,
  );
  return false;
}

async function main() {
  console.log(`Checking ${SUPABASE_URL} for visitors table…\n`);
  const exists = await tableExists();
  if (exists) {
    console.log('OK — `visitors` table is already present. Nothing to do.');
    return;
  }

  console.log('The `visitors` table does NOT exist yet.\n');
  console.log(
    'To enable the Visitors page, paste the SQL below into the Supabase SQL Editor:',
  );
  console.log(`  ${SUPABASE_URL.replace('//', '//app.')}/project/_/sql\n`);
  console.log('--- BEGIN supabase/migrations/0005_visitor_log.sql ---');
  try {
    const sql = await readFile(MIGRATION_PATH, 'utf8');
    console.log(sql.trimEnd());
  } catch (e) {
    console.error(
      `Could not read ${MIGRATION_PATH}:`,
      e instanceof Error ? e.message : e,
    );
  }
  console.log('--- END ---\n');
  console.log(
    'The Visitors page will render an empty-state message until this SQL has been applied.',
  );
}

main().catch((e) => {
  console.error('UNHANDLED:', e);
  process.exit(1);
});
