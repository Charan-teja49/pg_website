-- PG — Hostel Management
-- Migration 0006: nice-to-have student fields for future features.
--
-- All columns are nullable so existing rows aren't affected. Each unlocks
-- a feature that ships in a later release:
--   • dob                       → birthday tracker / age check on admission
--   • joining_date              → tenure on dashboard
--   • emergency_contact_name    → in-room sign / emergency call sheet
--   • emergency_contact_relation
--   • emergency_contact_mobile  → distinct from parent_mobile
--   • is_veg                    → mess preference, food-menu hint
--   • dietary_notes             → allergies, special needs
--
-- Run once in SQL Editor. Idempotent — `if not exists` guards on each.

alter table students
  add column if not exists dob date,
  add column if not exists joining_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relation text,
  add column if not exists emergency_contact_mobile text,
  add column if not exists is_veg boolean,
  add column if not exists dietary_notes text;

-- Optional index for birthday queries
create index if not exists idx_students_dob_month on students ((extract(month from dob)));
