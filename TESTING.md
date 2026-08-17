# Test the app end-to-end

Everything below assumes the dev server is running at `http://localhost:5173`. To start it: `pnpm dev`.

## Credentials

| Role | Email / Mobile | Password |
| --- | --- | --- |
| Super admin | `pg@vijayawada.local` | `Siddardha@123` |
| Student (Aarav) | `9876500001` | `Pg@Welcome123` |
| Student (Vivek) | `9876500002` | `Pg@Welcome123` |
| Student (Ananya) | `8765400007` | `Pg@Welcome123` |
| Student (Arjun) | `7654300012` | `Pg@Welcome123` |
| Student (Lakshmi) | `6543200017` | `Pg@Welcome123` |

(All 20 seeded students follow the pattern `<mobile>@pg.local` for the auth-user email; in the student login form they enter the mobile + welcome password.)

## Smoke tests

### Admin flow

1. Open http://localhost:5173 → public room view shows 4 buildings with live occupancy.
2. Click **Admin Login** → enter `pg@vijayawada.local` / `Siddardha@123`.
3. Land on `/admin` Dashboard. Sidebar dropdown defaults to **All buildings**. KPIs should show:
   - Students: **20**
   - Occupancy: **11 / 420** (Chalapathi + Stanza + Villas have assigned beds; Siddha is empty)
   - Revenue: a non-zero ₹ amount
   - Pending payments: **14** (8 partial + 6 pending)
4. Switch the dropdown to **Chalapathi** → KPIs filter to Chalapathi only.
5. **/admin/students** → 20 students. Use the **Pending** filter chip to see students with non-zero balance. Click **Export CSV** → downloads a CSV with masked Aadhaar.
6. Click **Add Student** → the form should have 5 sections (Personal, Academic, Identity, Hostel placement, Notes). **Room / bed** dropdown lists every free bed in the chosen building.
7. **/admin/rooms** → switch to **Chalapathi**. Use the search box to find `F-007`. Click to expand → see 6 beds and any occupants.
8. **/admin/payments** → searchable student picker. Pick Vivek → see his fee context (Partially Paid). Click **Pay full balance** → amount auto-fills. Save → fee status updates to Fully Paid.
9. **/admin/complaints** → category + status chips compose. Try changing a row's status.
10. **/admin/analytics** → charts render with seeded data.
11. **/admin/settings** → 4 building cards, edit any fee, click Save.

### Student flow

1. Open an incognito window → **Student Login** → mobile `9876500001`, password `Pg@Welcome123`.
2. A **Change password** modal appears (mandatory) since `must_change_password=true` was set during provisioning. Set a new 8+ char password.
3. After change, you're on `/student` Dashboard. Should see:
   - Aarav's name + bed (`F-001 · Bed 1`)
   - Fee summary: Fully Paid (₹102,000 of ₹102,000)
   - Recent payments (3 entries)
   - Announcements (last 5 global + Chalapathi-scoped)
4. **/student/complaints** → see Aarav's existing WiFi complaint (Solved). Submit a new one — appears at top.
5. **/student/payments** → fee summary card + record a small payment to test the flow.
6. **/student/transactions** → 3 payments with date/mode/method. Click **Export CSV** → file downloads.
7. **/student/food-menu** → 7-day × 3-meal grid with real Indian dishes.
8. **/student/room-change** → submit a request; it appears below with Pending status.

### Switch between buildings

In the admin sidebar:
- **All buildings** → dashboard shows aggregate + per-building table at bottom.
- **Stanza** → see floor>flat>room hierarchy with 60 beds (5 floors × 4 rooms × 3 beds).
- **Villas** → see 4 villas with 15 beds each.
- **Siddha** → empty; tells you to "configure rooms shortly" (Siddha's hierarchy isn't seeded — admin will set it later).

## Resetting

To re-seed the test data (wipes operational tables but keeps buildings/units/beds):

```powershell
$env:SUPABASE_SERVICE_KEY = "<service role key>"
node scripts/seed.mjs --force
```

To re-provision auth users (resets every student's password to `Pg@Welcome123` and flips the must-change flag back on):

```powershell
$env:SUPABASE_SERVICE_KEY = "<service role key>"
node scripts/provision-auth.mjs
```

## Common gotchas

- After resetting a student's password via the script, their existing logged-in session still works until its JWT expires (~1h). For an immediate forced re-login, sign them out manually in **Supabase → Authentication → Users → … → Sign out user**.
- If a query fails with a permissions error, check **Supabase → Authentication → Policies** for that table. `0003_rls.sql` set permissive policies, but new tables won't have any.
- The dev server runs in HMR. After Tailwind class changes, sometimes a hard refresh (`Ctrl+Shift+R`) helps shake off cached CSS.
