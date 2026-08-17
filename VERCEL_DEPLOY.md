# Deploy to Vercel

## One-time setup

1. **Sign in** at https://vercel.com using **GitHub**.
2. Click **Add New… → Project**.
3. Pick the GitHub repo **`sahith-krishna19/charan-pg-hostel`**.
4. **Framework Preset**: Vercel will auto-detect **Vite**. Leave it.
5. **Build & Output Settings** (defaults are fine):
   - Build command: `pnpm build`
   - Output directory: `dist`
   - Install command: `pnpm install`
6. **Environment Variables** — add these two (only):
   - `VITE_SUPABASE_URL` = `https://nedgpqnytcmfocjwocds.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon key from `.env.local` (a long string starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZGdwcW55dGNtZm9jandvY2RzIiwicm9sZSI6ImFub24i…`)
   
   **DO NOT** add the service role key to Vercel. Anything prefixed `VITE_` is bundled into the browser; service-role would leak everything.

7. Click **Deploy**. First build takes ~2 minutes.

8. After it deploys, you'll get a URL like `https://charan-pg-hostel.vercel.app`. Bookmark it.

## Allow your Vercel domain in Supabase

So the app can authenticate from production:

1. Supabase dashboard → **Authentication → URL Configuration**.
2. **Site URL**: paste your Vercel URL (e.g. `https://charan-pg-hostel.vercel.app`).
3. **Redirect URLs**: add the same URL plus a `/*` wildcard.
4. Save.

## Continuous deploys

After the first deploy, every `git push` to `main` triggers a redeploy automatically. Branch PRs get preview deploys at `<branch>.vercel.app`.

## Custom domain (optional)

1. Vercel project → **Settings → Domains**.
2. Add your domain (e.g. `pg.charanhostels.com`).
3. Vercel shows the DNS records to set at your registrar (CNAME or A records).
4. Once DNS propagates (~5 min), Vercel auto-provisions an HTTPS cert.
5. Also add the new domain to Supabase's Site URL / Redirect URLs.

## Smoke-test the production deploy

Open the Vercel URL in an incognito window:

| Path | What to check |
| --- | --- |
| `/` | PublicRoomView shows the 4 buildings + live occupancy |
| `/admin/login` | Email + password form, terracotta theme |
| `/student/login` | Mobile + password form, teal theme |

Then log in:

- **Admin**: `pg@vijayawada.local` / `Siddardha@123`
- **Student**: `9876500001` / `Pg@Welcome123` → first-login password-change modal appears

If anything misbehaves, check the Vercel **Logs** tab + the browser console.

## Rotating leaked keys

The service role JWT was shared in chat earlier. Rotate it:

1. Supabase → **Settings → API**.
2. Find **service_role** → click **Reset**.
3. Update any local `.env.server.local` and the secret store in any CI / Edge Functions that needed it.
4. The new key only matters for server-side scripts in `scripts/*.mjs`; the frontend uses the anon key, which is safe to keep as-is.
