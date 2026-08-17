-- PG — Hostel Management
-- Migration 0003: enable Row-Level Security with permissive policies for v1.
--
-- Strategy
--   • Tables with non-sensitive operational info (buildings, units, beds,
--     announcements, food_menu) are readable by anyone — including anon —
--     so the public landing page (PublicRoomView) and pre-login screens work.
--   • Sensitive tables (admins, students, fee_structures, payments,
--     complaints, room_change_requests, maintenance) require an authenticated
--     session.
--   • Any authenticated user can write any table for now. We'll tighten this
--     in 0004_rls_strict.sql once admin / building_staff / student logic is
--     fully wired and tested.
--
-- Run AFTER 0001_init and 0002_seed.

-- ============================================================
-- Enable RLS
-- ============================================================
alter table buildings           enable row level security;
alter table units               enable row level security;
alter table beds                enable row level security;
alter table students            enable row level security;
alter table fee_structures      enable row level security;
alter table payments            enable row level security;
alter table complaints          enable row level security;
alter table room_change_requests enable row level security;
alter table announcements       enable row level security;
alter table food_menu           enable row level security;
alter table maintenance         enable row level security;
alter table admins              enable row level security;

-- ============================================================
-- Public read tables (anon + authenticated)
-- ============================================================
create policy "buildings_read_public"     on buildings     for select using (true);
create policy "units_read_public"         on units         for select using (true);
create policy "beds_read_public"          on beds          for select using (true);
create policy "announcements_read_public" on announcements for select using (true);
create policy "food_menu_read_public"     on food_menu     for select using (true);

-- ============================================================
-- Sensitive read (authenticated only)
-- ============================================================
create policy "admins_read_auth"             on admins             for select to authenticated using (true);
create policy "students_read_auth"           on students           for select to authenticated using (true);
create policy "fee_structures_read_auth"     on fee_structures     for select to authenticated using (true);
create policy "payments_read_auth"           on payments           for select to authenticated using (true);
create policy "complaints_read_auth"         on complaints         for select to authenticated using (true);
create policy "rcr_read_auth"                on room_change_requests for select to authenticated using (true);
create policy "maintenance_read_auth"        on maintenance        for select to authenticated using (true);

-- ============================================================
-- Writes (authenticated only) — one combined policy per table.
-- 'for all' here covers insert/update/delete. SELECT keeps using
-- the read policies above; for sensitive tables, only the
-- authenticated read policy applies.
-- ============================================================
create policy "buildings_write_auth"         on buildings           for all to authenticated using (true) with check (true);
create policy "units_write_auth"             on units               for all to authenticated using (true) with check (true);
create policy "beds_write_auth"              on beds                for all to authenticated using (true) with check (true);
create policy "admins_write_auth"            on admins              for all to authenticated using (true) with check (true);
create policy "students_write_auth"          on students            for all to authenticated using (true) with check (true);
create policy "fee_structures_write_auth"    on fee_structures      for all to authenticated using (true) with check (true);
create policy "payments_write_auth"          on payments            for all to authenticated using (true) with check (true);
create policy "complaints_write_auth"        on complaints          for all to authenticated using (true) with check (true);
create policy "rcr_write_auth"               on room_change_requests for all to authenticated using (true) with check (true);
create policy "announcements_write_auth"     on announcements       for all to authenticated using (true) with check (true);
create policy "food_menu_write_auth"         on food_menu           for all to authenticated using (true) with check (true);
create policy "maintenance_write_auth"       on maintenance         for all to authenticated using (true) with check (true);
