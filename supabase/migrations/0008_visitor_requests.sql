-- PG — Hostel Management
-- Migration 0008: visitor flow becomes request → approval, not direct walk-in logging.
--
-- New columns:
--   status              'Pending' | 'Approved' | 'Rejected' (default Pending)
--   requested_arrival   timestamptz (when student expects the visitor)
--   decision_note       text (admin's reason for approve/reject)
--
-- `entered_at` is no longer auto-set on insert — admin marks the entry once
-- the visitor actually arrives. Walk-ins logged directly by admin still work
-- (the admin's "Log walk-in" button sets status='Approved' + entered_at=now()
-- in a single INSERT).
--
-- Run AFTER 0005_visitor_log.sql.

-- 1. Allow entered_at to be NULL while the visit is still a request.
alter table visitors alter column entered_at drop default;
alter table visitors alter column entered_at drop not null;

-- 2. New columns
alter table visitors
  add column if not exists status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected'));
alter table visitors
  add column if not exists requested_arrival timestamptz;
alter table visitors
  add column if not exists decision_note text;

-- 3. Back-fill: any existing rows with entered_at set were walk-ins; mark them Approved.
update visitors
   set status = 'Approved'
 where entered_at is not null
   and status = 'Pending';
