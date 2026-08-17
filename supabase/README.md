# Supabase setup — PG

## 1. Create the project

1. https://supabase.com/dashboard → **New project**
2. Region: **ap-south-1 (Mumbai)** for low latency from India.
3. Strong DB password — **save it**.
4. Wait ~2 min for the project to spin up.

## 2. Grab your keys

**Settings → API**, copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public** key → `VITE_SUPABASE_ANON_KEY`

Paste both into `.env.local` at the project root (copy from `.env.example`).

## 3. Run the SQL migrations

In **SQL Editor → New query**, paste each file's contents *in order* and click **Run**.

| Order | File | What it does |
| --- | --- | --- |
| 1 | [migrations/0001_init.sql](migrations/0001_init.sql) | Creates all tables, enums, indexes, triggers. |
| 2 | [migrations/0002_seed_buildings.sql](migrations/0002_seed_buildings.sql) | Seeds the 4 buildings, their unit/bed hierarchy, default food menu, and a super-admin row. |

After step 2 you should see:

- `buildings` — 4 rows
- `units` — 224 rows (50 + 35 + 4 + …)
- `beds` — 420 rows (300 Chalapathi + 60 Stanza + 60 Villas)
- `food_menu` — 84 rows (4 buildings × 7 days × 3 meals)
- `admins` — 1 row (`username='12345'`, no password yet)

## 4. Create the super-admin auth user

The `admins` row is just the role record; the password lives in **Supabase Auth**.

In **Authentication → Users → Add user**, create a user with:

- **Email**: `00000123450@pg.local` (synthetic — mobile + suffix; the `0` prefix is to make it 10 digits) *(or any email you like, then update the `admins.username` to match)*
- **Password**: pick something strong
- **Email confirm**: tick "Auto Confirm User"

Then in **SQL Editor**, link the auth user back to the admin row:

```sql
update admins
set    auth_user_id = (select id from auth.users where email = '00000123450@pg.local')
where  username = '12345';
```

> The app maps `mobile + password` login to Supabase Auth via the `mobile@pg.local` synthetic-email convention (see [src/app/lib/supabase.ts](../src/app/lib/supabase.ts) → `mobileToAuthEmail`). The 10-digit-padded mobile keeps the convention consistent for staff that don't have a real phone number on record.

## 5. Storage bucket for Aadhaar images

**Storage → New bucket**:

- Name: `aadhaar`
- Public: **off**
- File size limit: 5 MB
- Allowed MIME types: `image/png, image/jpeg, image/webp`

We'll add upload policies in `migrations/0003_storage_policies.sql` once we wire the Students page to Supabase.

## 6. RLS

Row-Level Security is **disabled** in `0001_init.sql` — fine for local dev with the anon key behind a single super-admin. We add real policies in `migrations/0003_rls.sql` *before* the first public deploy.

## 7. Adding a new building later

1. Add an enum value:
   ```sql
   alter type building_code add value 'new-block-code';
   ```
2. Append to `BUILDINGS` in [src/app/lib/buildings.ts](../src/app/lib/buildings.ts).
3. Insert the row + its unit/bed hierarchy via a new `0004_<name>.sql`.

## 8. Re-seeding (dev only)

To wipe and re-run the seed:

```sql
truncate beds, units, fee_structures, payments, complaints,
         room_change_requests, announcements, food_menu, maintenance,
         students, admins, buildings restart identity cascade;
```

Then re-run `0002_seed_buildings.sql`.
