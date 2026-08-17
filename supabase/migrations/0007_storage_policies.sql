-- PG — Hostel Management
-- Migration 0007: storage policies for the `aadhaar` bucket.
--
-- The bucket itself is already created by the admin (`scripts/setup-storage.mjs`)
-- with public=true. Reads are open, but writes/updates/deletes need policies.
--
-- Run ONCE in Supabase SQL Editor.

create policy "aadhaar_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'aadhaar');

create policy "aadhaar_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'aadhaar');

create policy "aadhaar_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'aadhaar')
  with check (bucket_id = 'aadhaar');

create policy "aadhaar_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'aadhaar');
