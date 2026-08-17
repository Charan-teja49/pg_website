-- PG — Hostel Management
-- Migration 0005: visitor log table.
--
-- Tracks people who entered / exited the PG to visit a student.
-- Designed as an append-only log: `entered_at` is set on insert,
-- `exited_at` is updated when the visitor leaves (NULL while still inside).
--
-- Paste this whole file into the Supabase SQL Editor and run.

create table visitors (
  id              bigserial primary key,
  building_id     bigint not null references buildings(id) on delete cascade,
  student_id      bigint references students(id) on delete set null,
  visitor_name    text not null,
  visitor_mobile  text,
  relation        text,                -- "Parent", "Sibling", "Friend"…
  purpose         text,
  entered_at      timestamptz not null default now(),
  exited_at       timestamptz,
  id_proof_note   text,                -- "Aadhaar XXXX-1234"
  notes           text,
  created_at      timestamptz not null default now()
);
create index idx_visitors_building on visitors(building_id);
create index idx_visitors_student  on visitors(student_id);
alter table visitors enable row level security;
create policy "visitors_read_auth"  on visitors for select to authenticated using (true);
create policy "visitors_write_auth" on visitors for all    to authenticated using (true) with check (true);
