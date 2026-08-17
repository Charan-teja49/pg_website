# Supabase Edge Functions — deploy guide

## `provision-student`

Auto-creates a Supabase Auth user when an admin adds a new student. The admin app calls it via `supabase.functions.invoke(...)`.

### One-time setup

**Option A — Supabase CLI (recommended; future deploys are 1 command):**

```powershell
# Install once on this machine:
npm install -g supabase

# Log in to your personal Supabase account:
supabase login

# Link this repo to your project (run from project root):
supabase link --project-ref nedgpqnytcmfocjwocds

# Deploy the function:
supabase functions deploy provision-student --no-verify-jwt
```

The `--no-verify-jwt` flag is needed because the function verifies the caller's JWT itself (it has to check the admin's auth_user_id against the `admins` table, which the default verifier doesn't do).

**Option B — Supabase Dashboard (manual paste):**

1. Open **Supabase → Edge Functions → Create a new function**.
2. Name: `provision-student`.
3. Paste the contents of `supabase/functions/provision-student/index.ts`.
4. Toggle **Verify JWT** to **OFF** (we verify it inside the handler).
5. **Deploy**.

### Verify it deployed

```powershell
curl -X POST `
  -H "Authorization: Bearer <admin-jwt-from-browser-devtools>" `
  -H "apikey: <anon-key>" `
  -H "Content-Type: application/json" `
  -d '{"student_id": 99}' `
  "https://nedgpqnytcmfocjwocds.supabase.co/functions/v1/provision-student"
```

Should return `{ "ok": true, "auth_user_id": "...", "email": "...", "welcome_password": "Pg@Welcome123" }`.

### How it's called from the app

After `createStudent` returns, `StudentsEnhanced.tsx` invokes:

```ts
const { data, error } = await supabase.functions.invoke('provision-student', {
  body: { student_id: created.id },
});
```

If it succeeds, the admin sees a toast with the welcome credentials. If it fails (e.g. function not deployed yet), the student row still exists — `scripts/provision-auth.mjs` is the manual fallback.
