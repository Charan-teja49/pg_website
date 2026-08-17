-- PG — Hostel Management — Migration 0004: comprehensive test data
--
-- Seeds operational data so every page in the admin UI has something to show.
-- Buildings / units / beds / admins are already seeded in 0002.
--
-- Run AFTER 0001_init, 0002_seed_buildings, 0003_rls on a fresh project.
--
-- What this seeds:
--   • 20 students across all 4 buildings
--   • 14 bed assignments (drives unit occupancy via trg_beds_recompute)
--   • 20 fee_structures (one per student, mix of Yearly / Semester)
--   • ~30 payments (mix of Online / Cash, varied methods + dates)
--   • Fee status reconciled: 6 Fully Paid, 8 Partially Paid, 6 Pending
--   • 15 complaints (mixed categories + statuses, last 3 weeks)
--   • 5 room change requests (mixed statuses)
--   • 14 announcements (6 global + 2 per building)
--   • 84 food_menu rows UPDATED with realistic Indian PG meals
--   • 10 maintenance entries across all buildings, last 6 months
--
-- Idempotency: NOT idempotent. Run once on a clean DB. Use the truncate
-- snippet in supabase/README.md if you need to re-run.

begin;

-- ============================================================
-- 1. STUDENTS — 20 plausible Indian rows
-- ============================================================
-- Distribution:
--   building 1 (chalapathi-main) : 6 students
--   building 2 (stanza)          : 5 students
--   building 3 (villas)          : 5 students
--   building 4 (siddha-middle)   : 4 students
-- bed_id intentionally NULL here; we assign in step 2 so the bed
-- triggers fire and set occupancy/vacancy_status correctly.
-- ============================================================
insert into students
  (mobile,       name,                    building_id, course, college_id,    parent_mobile, branch,                      aadhaar_number,  notes,                              status)
values
  -- Chalapathi Main (building 1) — 6 students
  ('9876500001', 'Aarav Sharma',          1, 'B.Tech', 'CSE2024001', '9123450001', 'Computer Science Engineering',        '234511110001', 'Vegetarian; prefers ground floor', 'active'),
  ('9876500002', 'Vivek Reddy',           1, 'B.Tech', 'ECE2023012', '9123450002', 'Electronics & Communication',         '234511110002', null,                                'active'),
  ('9876500003', 'Karthik Iyer',          1, 'B.Tech', 'MEC2024045', '9123450003', 'Mechanical Engineering',              '234511110003', null,                                'active'),
  ('9876500004', 'Rahul Verma',           1, 'B.Tech', 'CSE2023089', '9123450004', 'Computer Science Engineering',        '234511110004', 'Allergic to dairy',                 'active'),
  ('9876500005', 'Pradeep Kumar',         1, 'BBA',    'BBA2024021', '9123450005', 'Business Administration',             '234511110005', null,                                'active'),
  ('9876500006', 'Suresh Naidu',          1, 'B.Tech', 'CIV2023034', '9123450006', 'Civil Engineering',                   '234511110006', null,                                'active'),

  -- Stanza (building 2) — 5 students
  ('8765400007', 'Ananya Reddy',          2, 'B.Tech', 'CSE2024112', '9123450007', 'Computer Science Engineering',        '234511110007', null,                                'active'),
  ('8765400008', 'Priya Nair',            2, 'B.Tech', 'ECE2024056', '9123450008', 'Electronics & Communication',         '234511110008', 'Late night classes — gate pass',    'active'),
  ('8765400009', 'Sneha Patel',           2, 'B.Sc',   'BSC2023078', '9123450009', 'Bachelor of Science',                 '234511110009', null,                                'active'),
  ('8765400010', 'Divya Krishnan',        2, 'B.Tech', 'IT-2024023', '9123450010', 'Information Technology',              '234511110010', null,                                'active'),
  ('8765400011', 'Rohan Mehta',           2, 'MBA',    'MBA2024009', '9123450011', 'Business Administration',             '234511110011', null,                                'active'),

  -- Villas (building 3) — 5 students
  ('7654300012', 'Arjun Choudhary',       3, 'B.Tech', 'CSE2023145', '9123450012', 'Computer Science Engineering',        '234511110012', 'Early-morning gym — needs key',     'active'),
  ('7654300013', 'Siddharth Joshi',       3, 'B.Tech', 'CSE2024198', '9123450013', 'Computer Science Engineering',        '234511110013', null,                                'active'),
  ('7654300014', 'Manish Kulkarni',       3, 'B.Tech', 'ECE2023167', '9123450014', 'Electronics & Communication',         '234511110014', null,                                'active'),
  ('7654300015', 'Akhil Subramanian',     3, 'B.Tech', 'AIE2024003', '9123450015', 'Artificial Intelligence',             '234511110015', null,                                'active'),
  ('7654300016', 'Harish Bhat',           3, 'B.Tech', 'MEC2023201', '9123450016', 'Mechanical Engineering',              '234511110016', null,                                'active'),

  -- Siddha Middle Block (building 4) — 4 students
  ('6543200017', 'Lakshmi Devi',          4, 'B.Tech', 'CSE2024076', '9123450017', 'Computer Science Engineering',        '234511110017', null,                                'active'),
  ('6543200018', 'Kavya Menon',           4, 'B.Tech', 'IT-2023044', '9123450018', 'Information Technology',              '234511110018', null,                                'active'),
  ('6543200019', 'Ramya Sundaram',        4, 'B.Sc',   'BSC2024055', '9123450019', 'Bachelor of Science',                 '234511110019', 'Vegetarian Jain food',              'active'),
  ('6543200020', 'Pooja Iyengar',         4, 'BBA',    'BBA2023117', '9123450020', 'Business Administration',             '234511110020', null,                                'active');

-- ============================================================
-- 2. BED ASSIGNMENTS — 14 of 20 students get a bed
-- ============================================================
-- Strategy: spread occupancy across different units so the
-- vacancy dashboard shows a healthy mix of Available / Partially
-- Occupied / Occupied. Triggers in 0001 recompute unit counts.
--
-- We pick beds by (building_id, unit label, bed label) then run
-- a paired update on beds + students. The 6 unassigned students
-- (mobiles ending 03, 06, 11, 14, 16, 19) act as "waitlist /
-- pending allocation" — useful for testing that view.
-- ============================================================

-- Each assignment below is two paired statements: the first
-- marks the bed occupied (with the student id pulled in via a
-- CTE), the second mirrors bed_id back onto the student row.
-- Beds are looked up by (building_id, unit label, bed label)
-- so we don't depend on auto-increment ordering.

-- Chalapathi Main: F-001 (Aarav, Vivek), F-002 (Rahul), F-005 (Pradeep)

with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '9876500001'
   where u.label = 'F-001'
     and u.building_id = 1
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'F-001'
        and u.building_id = 1
        and b.label = 'Bed 1'
   )
 where mobile = '9876500001';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '9876500002'
   where u.label = 'F-001'
     and u.building_id = 1
     and b.label = 'Bed 2'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'F-001'
        and u.building_id = 1
        and b.label = 'Bed 2'
   )
 where mobile = '9876500002';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '9876500004'
   where u.label = 'F-002'
     and u.building_id = 1
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'F-002'
        and u.building_id = 1
        and b.label = 'Bed 1'
   )
 where mobile = '9876500004';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '9876500005'
   where u.label = 'F-005'
     and u.building_id = 1
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'F-005'
        and u.building_id = 1
        and b.label = 'Bed 1'
   )
 where mobile = '9876500005';


-- Stanza: Ananya in S-1A-R1 Bed 1,
--         Priya in S-1A-R1 Bed 2,
--         Sneha in S-2A-R1 Bed 1,
--         Divya in S-3B-R2 Bed 1

with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '8765400007'
   where u.label = 'S-1A-R1'
     and u.building_id = 2
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'S-1A-R1'
        and u.building_id = 2
        and b.label = 'Bed 1'
   )
 where mobile = '8765400007';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '8765400008'
   where u.label = 'S-1A-R1'
     and u.building_id = 2
     and b.label = 'Bed 2'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'S-1A-R1'
        and u.building_id = 2
        and b.label = 'Bed 2'
   )
 where mobile = '8765400008';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '8765400009'
   where u.label = 'S-2A-R1'
     and u.building_id = 2
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'S-2A-R1'
        and u.building_id = 2
        and b.label = 'Bed 1'
   )
 where mobile = '8765400009';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '8765400010'
   where u.label = 'S-3B-R2'
     and u.building_id = 2
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'S-3B-R2'
        and u.building_id = 2
        and b.label = 'Bed 1'
   )
 where mobile = '8765400010';


-- Villas: Arjun (Villa-1 Bed 1),
--         Siddharth (Villa-1 Bed 2),
--         Akhil (Villa-2 Bed 1),
--         Harish (Villa-3 Bed 5)

with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '7654300012'
   where u.label = 'Villa-1'
     and u.building_id = 3
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'Villa-1'
        and u.building_id = 3
        and b.label = 'Bed 1'
   )
 where mobile = '7654300012';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '7654300013'
   where u.label = 'Villa-1'
     and u.building_id = 3
     and b.label = 'Bed 2'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'Villa-1'
        and u.building_id = 3
        and b.label = 'Bed 2'
   )
 where mobile = '7654300013';


with picked as (
  select b.id as bed_id, s.id as student_id
    from beds b
    join units u on u.id = b.unit_id
    join students s on s.mobile = '7654300015'
   where u.label = 'Villa-2'
     and u.building_id = 3
     and b.label = 'Bed 1'
   limit 1
)
update beds
   set is_occupied = true,
       student_id = picked.student_id
  from picked
 where beds.id = picked.bed_id;

update students
   set bed_id = (
     select b.id
       from beds b
       join units u on u.id = b.unit_id
      where u.label = 'Villa-2'
        and u.building_id = 3
        and b.label = 'Bed 1'
   )
 where mobile = '7654300015';


-- Siddha middle block has NO units seeded yet.
-- The 4 Siddha students remain unassigned.

-- ============================================================
-- 3. FEE STRUCTURES — one row per student
-- ============================================================
-- Per-building fee table (matches 0002 buildings):
--   bid 1 (chalapathi):  95000 + 5000 + 2000 = 102000
--   bid 2 (stanza)    :  85000 +    0 + 2000 =  87000
--   bid 3 (villas)    : 100000 +    0 + 2000 = 102000
--   bid 4 (siddha)    :  85000 + 5000 + 2000 =  92000
--
-- Most students Yearly; 5 chosen to be Semester (Vivek, Sneha,
-- Rohan, Akhil, Pooja). total_paid / balance_amount get fixed
-- up after payments are inserted in step 4.
-- ============================================================
insert into fee_structures
  (student_id, payment_plan, yearly_fee, electricity_fee, non_refundable_fee, total_payable, total_paid, balance_amount, payment_status)
select
  s.id,
  case when s.mobile in ('9876500002','8765400009','8765400011','7654300015','6543200020')
       then 'Semester'::payment_plan
       else 'Yearly'::payment_plan end,
  case s.building_id when 1 then 95000 when 2 then 85000 when 3 then 100000 when 4 then 85000 end,
  case s.building_id when 1 then 5000  when 2 then     0 when 3 then      0 when 4 then 5000  end,
  2000,
  case s.building_id when 1 then 102000 when 2 then 87000 when 3 then 102000 when 4 then 92000 end,
  0,
  case s.building_id when 1 then 102000 when 2 then 87000 when 3 then 102000 when 4 then 92000 end,
  'Pending'::payment_status
from students s
order by s.id;


-- ============================================================
-- 4. PAYMENTS — ~30 rows across students
-- ============================================================
-- Target distribution:
--   FULLY PAID (6):     Aarav, Ananya, Arjun, Lakshmi, Pradeep, Karthik
--   PARTIALLY PAID (8): Vivek, Rahul, Priya, Sneha, Siddharth, Akhil, Kavya, Pooja
--   PENDING (6):        Suresh, Divya, Rohan, Manish, Harish, Ramya
--
-- payment_method is NULL when payment_mode='Cash'.
-- Dates spread over the last ~4 months (Jan–May 2026 from
-- today 2026-05-11).
-- ============================================================

-- Helper macro: insert a payment using student mobile lookup.
-- Repeating an inline pattern beats a function for clarity here.

-- ---- Aarav (9876500001, building 1, total 102000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='9876500001'), 50000, 'Online', 'PhonePe',       current_date - 105, 'Charan',    'Initial admission deposit'),
  ((select id from students where mobile='9876500001'), 30000, 'Online', 'Google Pay',    current_date -  60, 'Charan',    null),
  ((select id from students where mobile='9876500001'), 22000, 'Cash',    null,           current_date -  20, 'Ramesh',    'Final balance');

-- ---- Vivek (9876500002, building 1, total 102000) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='9876500002'), 40000, 'Online', 'PhonePe',       current_date -  90, 'Charan'),
  ((select id from students where mobile='9876500002'), 25000, 'Cash',    null,           current_date -  30, 'Ramesh');

-- ---- Karthik (9876500003, building 1, total 102000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='9876500003'),102000, 'Online', 'Bank Transfer', current_date - 100, 'Charan',    'Lump sum yearly');

-- ---- Rahul (9876500004, building 1, total 102000) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='9876500004'), 50000, 'Online', 'Paytm',         current_date -  80, 'Charan'),
  ((select id from students where mobile='9876500004'), 20000, 'Online', 'PhonePe',       current_date -  15, 'Charan');

-- ---- Pradeep (9876500005, building 1, total 102000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='9876500005'), 60000, 'Online', 'Google Pay',    current_date -  95, 'Charan'),
  ((select id from students where mobile='9876500005'), 42000, 'Cash',    null,           current_date -  40, 'Ramesh');

-- ---- Suresh (9876500006) — PENDING (no payments)

-- ---- Ananya (8765400007, building 2, total 87000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='8765400007'), 87000, 'Online', 'Bank Transfer', current_date -  85, 'Sita',      'Full year via NEFT');

-- ---- Priya (8765400008, building 2, total 87000) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='8765400008'), 30000, 'Online', 'PhonePe',       current_date -  75, 'Sita'),
  ((select id from students where mobile='8765400008'), 20000, 'Online', 'Google Pay',    current_date -  25, 'Sita');

-- ---- Sneha (8765400009, building 2, total 87000) — PARTIAL (Semester)
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='8765400009'), 45000, 'Cash',    null,           current_date -  70, 'Ramesh',    'Semester 1');

-- ---- Divya (8765400010) — PENDING

-- ---- Rohan (8765400011, building 2, Semester) — PENDING

-- ---- Arjun (7654300012, building 3, total 102000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='7654300012'), 60000, 'Online', 'Bank Transfer', current_date - 110, 'Charan',    'First instalment'),
  ((select id from students where mobile='7654300012'), 42000, 'Online', 'PhonePe',       current_date -  35, 'Charan',    null);

-- ---- Siddharth (7654300013, building 3, total 102000) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='7654300013'), 50000, 'Cash',    null,           current_date -  70, 'Ramesh'),
  ((select id from students where mobile='7654300013'), 25000, 'Online', 'Paytm',         current_date -  10, 'Charan');

-- ---- Manish (7654300014) — PENDING

-- ---- Akhil (7654300015, building 3, Semester) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='7654300015'), 51000, 'Online', 'Google Pay',    current_date -  55, 'Charan');

-- ---- Harish (7654300016) — PENDING

-- ---- Lakshmi (6543200017, building 4, total 92000) — FULLY PAID
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='6543200017'), 50000, 'Online', 'PhonePe',       current_date -  90, 'Lakshman',  null),
  ((select id from students where mobile='6543200017'), 42000, 'Online', 'Bank Transfer', current_date -  20, 'Lakshman',  'Final settlement');

-- ---- Kavya (6543200018, building 4, total 92000) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by)
values
  ((select id from students where mobile='6543200018'), 30000, 'Cash',    null,           current_date -  60, 'Lakshman'),
  ((select id from students where mobile='6543200018'), 15000, 'Online', 'PhonePe',       current_date -  18, 'Lakshman');

-- ---- Ramya (6543200019) — PENDING

-- ---- Pooja (6543200020, building 4, Semester) — PARTIAL
insert into payments (student_id, amount, payment_mode, payment_method, payment_date, received_by, transaction_notes)
values
  ((select id from students where mobile='6543200020'), 46000, 'Online', 'Other',         current_date -  45, 'Lakshman',  'UPI - SBI Yono');


-- ============================================================
-- 5. RECONCILE fee_structures from payments
-- ============================================================
-- Single UPDATE: pull each student's payment sum and update
-- total_paid + balance_amount + payment_status atomically.
-- ============================================================
update fee_structures fs
   set total_paid     = coalesce(p.total, 0),
       balance_amount = fs.total_payable - coalesce(p.total, 0),
       payment_status = case
         when coalesce(p.total, 0) = 0                          then 'Pending'::payment_status
         when fs.total_payable - coalesce(p.total, 0) <= 0      then 'Fully Paid'::payment_status
         else                                                        'Partially Paid'::payment_status
       end
  from (
    select student_id, sum(amount) as total
      from payments
     group by student_id
  ) p
 where p.student_id = fs.student_id;

-- Students with zero payments aren't in the subquery above,
-- but they were already inserted with total_paid=0 and
-- payment_status='Pending', so no further action needed.


-- ============================================================
-- 6. COMPLAINTS — 15 rows, mixed categories + statuses
-- ============================================================
-- Spread over the last 21 days. Use student mobile lookups so
-- the rows survive any future student id renumbering.
-- ============================================================
insert into complaints (student_id, building_id, category, description, status, created_at, updated_at)
values
  ((select id from students where mobile='9876500001'), 1, 'WiFi',        'WiFi disconnects every evening between 8-10 PM',                  'Solved',      now() - interval '20 days', now() - interval '15 days'),
  ((select id from students where mobile='9876500002'), 1, 'Plumbing',    'Bathroom tap leaking continuously, water wastage',                'In Progress', now() - interval '6 days',  now() - interval '2 days'),
  ((select id from students where mobile='9876500004'), 1, 'AC',          'AC in flat F-002 not cooling, needs gas refill',                  'Unsolved',    now() - interval '2 days',  now() - interval '2 days'),
  ((select id from students where mobile='9876500005'), 1, 'Electricity', 'Power socket near study table not working',                       'Solved',      now() - interval '18 days', now() - interval '14 days'),
  ((select id from students where mobile='9876500003'), 1, 'Cleaning',    'Common corridor not cleaned for 3 days',                          'In Progress', now() - interval '4 days',  now() - interval '1 days'),

  ((select id from students where mobile='8765400007'), 2, 'WiFi',        'WiFi speed very slow on 2nd floor, especially in S-1A-R1',        'Unsolved',    now() - interval '3 days',  now() - interval '3 days'),
  ((select id from students where mobile='8765400008'), 2, 'Plumbing',    'Hot water not coming in shower from 6 AM-8 AM',                   'Solved',      now() - interval '15 days', now() - interval '10 days'),
  ((select id from students where mobile='8765400009'), 2, 'Cleaning',    'Cockroach problem in kitchen of S-2A',                            'In Progress', now() - interval '8 days',  now() - interval '5 days'),
  ((select id from students where mobile='8765400010'), 2, 'Others',      'Door lock of S-3B-R2 stuck, key not turning',                     'Unsolved',    now() - interval '1 days',  now() - interval '1 days'),

  ((select id from students where mobile='7654300012'), 3, 'Electricity', 'Inverter not switching during power cuts in Villa-1',             'Solved',      now() - interval '17 days', now() - interval '13 days'),
  ((select id from students where mobile='7654300013'), 3, 'AC',          'Villa-1 hall AC making loud noise',                               'In Progress', now() - interval '9 days',  now() - interval '4 days'),
  ((select id from students where mobile='7654300015'), 3, 'WiFi',        'Router placement bad — no signal in Villa-2 Bed 1 area',          'Unsolved',    now() - interval '5 days',  now() - interval '5 days'),

  ((select id from students where mobile='6543200017'), 4, 'Plumbing',    'Drainage block in 1st floor washroom',                            'Solved',      now() - interval '19 days', now() - interval '12 days'),
  ((select id from students where mobile='6543200018'), 4, 'Cleaning',    'Garbage not picked up for 2 days',                                'In Progress', now() - interval '7 days',  now() - interval '3 days'),
  ((select id from students where mobile='6543200020'), 4, 'Others',      'Mess timing inconsistent — dinner served late multiple times',    'Unsolved',    now() - interval '2 days',  now() - interval '2 days');


-- ============================================================
-- 7. ROOM CHANGE REQUESTS — 5 rows, mixed statuses
-- ============================================================
insert into room_change_requests (student_id, current_bed_id, requested_unit_id, reason, status, created_at)
values
  ((select id from students where mobile='9876500002'),
   (select bed_id from students where mobile='9876500002'),
   (select id from units where label='F-010' and building_id=1),
   'Roommate snores heavily, sleep is suffering',
   'Pending',
   now() - interval '4 days'),

  ((select id from students where mobile='9876500004'),
   (select bed_id from students where mobile='9876500004'),
   (select id from units where label='F-003' and building_id=1),
   'Want to move closer to friend group in F-003',
   'Approved',
   now() - interval '14 days'),

  ((select id from students where mobile='8765400008'),
   (select bed_id from students where mobile='8765400008'),
   (select id from units where label='S-2A-R1' and building_id=2),
   'Currently sharing with 2 students; requesting different room layout',
   'Rejected',
   now() - interval '10 days'),

  ((select id from students where mobile='7654300013'),
   (select bed_id from students where mobile='7654300013'),
   (select id from units where label='Villa-3' and building_id=3),
   'Allergic to ground floor humidity, prefer upper floor villa',
   'Pending',
   now() - interval '6 days'),

  ((select id from students where mobile='7654300015'),
   (select bed_id from students where mobile='7654300015'),
   (select id from units where label='Villa-1' and building_id=3),
   'Wants to be with batchmates from same college',
   'Approved',
   now() - interval '22 days');


-- ============================================================
-- 8. ANNOUNCEMENTS — 6 global + 2 per building (= 14 total)
-- ============================================================
insert into announcements (building_id, title, message, created_at)
values
  -- Global announcements (building_id NULL)
  (null, 'Diwali Holiday Notice',
         'Hostel will operate with skeleton mess service from Nov 1-3 for Diwali. Plan your travel and inform the warden.',
         now() - interval '60 days'),
  (null, 'Hostel Fee Reminder',
         'Pending fee payments must be cleared by the 15th of this month. Late payment penalty applies after that.',
         now() - interval '12 days'),
  (null, 'New WiFi Provider',
         'We have switched to ACT Fibernet (200 Mbps unlimited) across all buildings. Please update your devices with the new SSID.',
         now() - interval '40 days'),
  (null, 'Annual Hostel Day Celebration',
         'Hostel Day on May 25th — cultural events, dinner, and prize distribution. RSVP at the front desk.',
         now() - interval '5 days'),
  (null, 'Visitor Policy Update',
         'Parents and visitors must register at the gate and leave by 8 PM on weekdays, 9 PM on weekends.',
         now() - interval '25 days'),
  (null, 'Mess Vendor Change',
         'We are introducing a new mess vendor (Annapurna Caterers) starting next Monday. Feedback welcome.',
         now() - interval '8 days'),

  -- Chalapathi Main (id 1) — 2 announcements
  (1,    'Chalapathi: Water Tank Cleaning',
         'Water supply will be off on Saturday 9 AM to 2 PM for tank cleaning. Store water in advance.',
         now() - interval '3 days'),
  (1,    'Chalapathi: Lift Maintenance',
         'Lift in Block A under maintenance for 2 days. Use staircase. Sorry for the inconvenience.',
         now() - interval '17 days'),

  -- Stanza (id 2) — 2 announcements
  (2,    'Stanza: Pest Control This Sunday',
         'Pest control on Sunday 10 AM. Please vacate flats from 9:30 AM to 12:30 PM and lock food items.',
         now() - interval '2 days'),
  (2,    'Stanza: Generator Test',
         'Backup generator load test scheduled Wednesday 11 AM. Power may fluctuate for 30 minutes.',
         now() - interval '20 days'),

  -- Villas (id 3) — 2 announcements
  (3,    'Villas: Garden Cleanup Drive',
         'Volunteers wanted for villa garden cleanup this Saturday 7 AM. Refreshments provided.',
         now() - interval '7 days'),
  (3,    'Villas: New Common Room TV',
         'A 55-inch smart TV has been installed in Villa-1 common room. Please use it responsibly.',
         now() - interval '30 days'),

  -- Siddha Middle (id 4) — 2 announcements
  (4,    'Siddha: Building Hierarchy Setup',
         'Building layout is being finalised by management. Bed allocation will start once units are added.',
         now() - interval '15 days'),
  (4,    'Siddha: Welcome New Residents',
         'A warm welcome to our new Siddha residents. Orientation session on Saturday 5 PM in the lobby.',
         now() - interval '10 days');


-- ============================================================
-- 9. FOOD MENU — UPDATE the 84 placeholder rows
-- ============================================================
-- 0002 inserted 4 buildings × 7 days × 3 meals = 84 rows with
-- items='—'. Replace with realistic Indian PG menu. Same menu
-- across buildings keeps the kitchen logistics simple; admin
-- can later vary per-building via the UI.
-- ============================================================

update food_menu set items = 'Idli + Sambar + Coconut Chutney + Tea/Coffee'
  where day_of_week = 'Monday' and meal_type = 'Breakfast';
update food_menu set items = 'Rice + Sambar + Aloo Curry + Curd + Pickle + Papad'
  where day_of_week = 'Monday' and meal_type = 'Lunch';
update food_menu set items = 'Chapati + Paneer Butter Masala + Dal Tadka + Rice + Salad'
  where day_of_week = 'Monday' and meal_type = 'Dinner';

update food_menu set items = 'Poha + Boiled Eggs + Banana + Tea/Milk'
  where day_of_week = 'Tuesday' and meal_type = 'Breakfast';
update food_menu set items = 'Chapati + Dal Fry + Bhindi Masala + Rice + Curd'
  where day_of_week = 'Tuesday' and meal_type = 'Lunch';
update food_menu set items = 'Veg Pulao + Raita + Mixed Veg Curry + Pickle'
  where day_of_week = 'Tuesday' and meal_type = 'Dinner';

update food_menu set items = 'Upma + Coconut Chutney + Filter Coffee'
  where day_of_week = 'Wednesday' and meal_type = 'Breakfast';
update food_menu set items = 'Rice + Rasam + Cabbage Poriyal + Curd + Mango Pickle'
  where day_of_week = 'Wednesday' and meal_type = 'Lunch';
update food_menu set items = 'Chapati + Chana Masala + Jeera Rice + Boondi Raita'
  where day_of_week = 'Wednesday' and meal_type = 'Dinner';

update food_menu set items = 'Bread + Butter + Jam + Boiled Eggs + Milk'
  where day_of_week = 'Thursday' and meal_type = 'Breakfast';
update food_menu set items = 'Rice + Sambar + Beans Curry + Curd + Pickle + Papad'
  where day_of_week = 'Thursday' and meal_type = 'Lunch';
update food_menu set items = 'Chapati + Egg Curry / Soya Chunks Masala + Dal + Rice'
  where day_of_week = 'Thursday' and meal_type = 'Dinner';

update food_menu set items = 'Dosa + Sambar + Tomato Chutney + Tea'
  where day_of_week = 'Friday' and meal_type = 'Breakfast';
update food_menu set items = 'Chapati + Dal Makhani + Aloo Gobi + Rice + Curd'
  where day_of_week = 'Friday' and meal_type = 'Lunch';
update food_menu set items = 'Veg Biryani + Mirchi ka Salan + Raita + Boiled Egg'
  where day_of_week = 'Friday' and meal_type = 'Dinner';

update food_menu set items = 'Aloo Paratha + Curd + Pickle + Chai'
  where day_of_week = 'Saturday' and meal_type = 'Breakfast';
update food_menu set items = 'Chicken Curry / Paneer Curry + Chapati + Rice + Dal + Salad'
  where day_of_week = 'Saturday' and meal_type = 'Lunch';
update food_menu set items = 'Fried Rice + Manchurian + Veg Soup'
  where day_of_week = 'Saturday' and meal_type = 'Dinner';

update food_menu set items = 'Puri + Aloo Sabzi + Halwa (special) + Tea'
  where day_of_week = 'Sunday' and meal_type = 'Breakfast';
update food_menu set items = 'Veg Thali — Rice + Dal + 2 Curries + Roti + Sweet + Curd + Papad'
  where day_of_week = 'Sunday' and meal_type = 'Lunch';
update food_menu set items = 'Chapati + Mixed Veg Korma + Dal + Rice + Ice Cream'
  where day_of_week = 'Sunday' and meal_type = 'Dinner';


-- ============================================================
-- 10. MAINTENANCE — 10 entries spread over last 6 months
-- ============================================================
insert into maintenance (building_id, description, cost, performed_on, notes)
values
  (1, 'Plumbing repair — leakage on 2nd floor (flats F-018 to F-022)', 4500,  current_date -  10, 'Plumber: Ravi Plumbing Services'),
  (1, 'Common area painting — main entrance and lobby',                12000, current_date -  45, 'Paint vendor: Asian Paints contract'),
  (1, 'Pest control — all 50 flats (quarterly)',                        7500,  current_date - 100, 'PestX agency, full building'),

  (2, 'Generator service + diesel top-up',                              3200,  current_date -  20, 'Power Solutions Pvt Ltd'),
  (2, 'Lift annual maintenance contract renewal',                       9000,  current_date -  60, 'Otis service contract'),
  (2, 'Water tank cleaning — overhead + sump',                          2800,  current_date - 130, 'Cleaning crew of 3'),

  (3, 'Garden landscaping + new plants',                                6500,  current_date -  35, 'Local nursery vendor'),
  (3, 'Villa-2 roof waterproofing',                                     14500, current_date - 150, 'Dr Fixit applicator'),

  (4, 'Electrical wiring inspection + minor repairs',                   5200,  current_date -  25, 'Licensed electrician'),
  (4, 'CCTV camera installation — 4 cameras at gate and corridor',      11800, current_date -  75, 'Hikvision installation, 1-year warranty');


commit;

-- ============================================================
-- DONE.
--
-- Quick verification queries you can run after this seed:
--
--   select count(*) from students;                              -- expect 20
--   select count(*) from beds where is_occupied;                -- expect 14
--   select count(*) from fee_structures;                        -- expect 20
--   select count(*) from payments;                              -- expect 30
--   select payment_status, count(*) from fee_structures
--     group by 1 order by 1;                                    -- 6 / 8 / 6
--   select count(*) from complaints;                            -- expect 15
--   select count(*) from room_change_requests;                  -- expect 5
--   select count(*) from announcements;                         -- expect 14
--   select count(*) from food_menu where items <> '—';          -- expect 84
--   select count(*) from maintenance;                           -- expect 10
--
-- Unit occupancy sanity check (Chalapathi F-001 should show
-- 2/6 occupied → 'Partially Occupied'):
--
--   select label, capacity, occupied_count, vacancy_status
--     from units where building_id = 1 and label = 'F-001';
-- ============================================================
