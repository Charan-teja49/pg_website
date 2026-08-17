# Student auth provisioning — manual flow

The "Add Student" form in the admin app creates a `students` row but *not* a
Supabase Auth user. Until we automate this with an Edge Function or the
Admin Auth API, here's the 30-second manual process per student.

## 1. Create the auth user in the dashboard

**Supabase dashboard → Authentication → Users → Add user → "Create new user"**

- **Email**: `<10-digit-mobile>@pg.local` (e.g. `9876543210@pg.local`)
- **Password**: pick any password (or let the student pick on first login)
- **Auto Confirm User**: ✅ ON

The app's login flow already maps `mobile + password` to this synthetic email
(see `src/app/lib/supabase.ts → mobileToAuthEmail`).

## 2. Link the auth user to the student row

In **SQL Editor**, paste **one** of these:

### a) Link one student by mobile

```sql
update students
set    auth_user_id = (select id from auth.users where email = '9876543210@pg.local')
where  mobile = '9876543210';

-- verify
select id, name, mobile, auth_user_id from students where mobile = '9876543210';
```

### b) Bulk-link every student whose email matches the convention

Run this whenever you've batch-created auth users following the
`<mobile>@pg.local` convention.

```sql
update students s
set    auth_user_id = au.id
from   auth.users au
where  au.email = s.mobile || '@pg.local'
  and  s.auth_user_id is null;

-- verify count
select count(*) as linked from students where auth_user_id is not null;
```

## 3. (Optional) Bulk-provision auth users for every seeded student

Run **once** in SQL Editor — uses the Supabase auth admin extension to
insert into `auth.users` directly with a default password.

> Default password set below is **`Welcome@123`** — change it before running,
> and ask students to reset it on first login. Skip students who already
> have an `auth_user_id`.

```sql
-- Requires Supabase's default auth extension. Will fail with a permission
-- error if the user running this lacks privileges to the `auth` schema —
-- in that case fall back to creating users one by one via the dashboard.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data,
  raw_user_meta_data, is_super_admin, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  s.mobile || '@pg.local',
  crypt('Welcome@123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('mobile', s.mobile, 'name', s.name),
  false, '', '', '', ''
from students s
where s.auth_user_id is null
  and not exists (
    select 1 from auth.users a where a.email = s.mobile || '@pg.local'
  );

-- Then link the new auth users back to students
update students s
set    auth_user_id = au.id
from   auth.users au
where  au.email = s.mobile || '@pg.local'
  and  s.auth_user_id is null;

-- verify
select s.id, s.name, s.mobile, s.auth_user_id
from   students s
order  by s.id
limit  20;
```

After running this, every seeded student can log in at `/student/login` with
their 10-digit mobile + `Welcome@123`.

## 4. Resetting a password

If a student forgets, change it via dashboard → Authentication → Users →
click the user → "Send password recovery" (email path won't work for
synthetic emails) — instead just set a new password under "Reset password".
