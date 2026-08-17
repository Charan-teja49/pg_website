-- PG — Hostel Management
-- Migration 0001: initial multi-building schema
--
-- Run this once in Supabase Dashboard → SQL Editor → New query.
-- Idempotent? No. Run once on a fresh project.

-- ============================================================
-- ENUMS
-- ============================================================
create type building_code as enum (
  'chalapathi-main', 'stanza', 'villas', 'siddha-middle'
);

create type unit_type as enum (
  'floor', 'flat', 'room', 'villa', 'other'
);

create type vacancy_status as enum (
  'Available', 'Partially Occupied', 'Occupied'
);

create type payment_plan as enum ('Yearly', 'Semester');

create type payment_status as enum (
  'Pending', 'Partially Paid', 'Fully Paid'
);

create type payment_mode as enum ('Online', 'Cash');

create type payment_method as enum (
  'PhonePe', 'Google Pay', 'Paytm', 'Bank Transfer', 'Other'
);

create type complaint_category as enum (
  'Electricity', 'Plumbing', 'AC', 'WiFi', 'Cleaning', 'Others'
);

create type complaint_status as enum ('Unsolved', 'In Progress', 'Solved');

create type room_change_status as enum ('Pending', 'Approved', 'Rejected');

create type student_status as enum ('active', 'inactive');

create type admin_role as enum ('super', 'building_staff');

-- ============================================================
-- BUILDINGS
-- ============================================================
create table buildings (
  id                  bigserial primary key,
  code                building_code unique not null,
  name                text not null,
  short_name          text not null,
  yearly_fee          numeric(10,2) not null,
  electricity_fee     numeric(10,2) not null default 0,
  non_refundable_fee  numeric(10,2) not null default 0,
  planned_capacity    integer not null default 0,
  hierarchy           jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- UNITS  (floors / flats / rooms / villas)
-- Self-referencing parent pointer lets one table model every
-- building's hierarchy regardless of depth.
-- ============================================================
create table units (
  id              bigserial primary key,
  building_id     bigint not null references buildings(id) on delete cascade,
  parent_unit_id  bigint references units(id) on delete cascade,
  type            unit_type not null,
  label           text not null,
  capacity        integer not null default 0,
  occupied_count  integer not null default 0,
  vacancy_status  vacancy_status not null default 'Available',
  notes           text,
  created_at      timestamptz not null default now(),
  unique (building_id, type, label)
);

create index idx_units_building on units(building_id);
create index idx_units_parent on units(parent_unit_id);

-- ============================================================
-- BEDS
-- ============================================================
create table beds (
  id              bigserial primary key,
  unit_id         bigint not null references units(id) on delete cascade,
  label           text not null,
  is_occupied     boolean not null default false,
  student_id      bigint,
  created_at      timestamptz not null default now(),
  unique (unit_id, label)
);

create index idx_beds_unit on beds(unit_id);
create index idx_beds_student on beds(student_id);

-- ============================================================
-- STUDENTS
-- Auth: we mirror Supabase Auth users into this table by
-- setting students.id = auth.users.id (uuid) when a row is
-- created via the `register_student` RPC. Until then we just
-- use a bigserial id and store the supabase auth user uuid
-- in `auth_user_id`.
-- ============================================================
create table students (
  id                bigserial primary key,
  auth_user_id      uuid unique,                          -- references auth.users(id)
  mobile            text unique not null,
  name              text not null,
  building_id       bigint references buildings(id) on delete set null,
  bed_id            bigint references beds(id) on delete set null,
  course            text,
  college_id        text unique,
  parent_mobile     text,
  branch            text,
  aadhaar_number    text unique,
  aadhaar_image_url text,
  notes             text,
  status            student_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_students_building on students(building_id);
create index idx_students_mobile on students(mobile);

-- forward-add the FK from beds back to students
alter table beds
  add constraint fk_beds_student
  foreign key (student_id) references students(id) on delete set null;

-- ============================================================
-- FEE STRUCTURES (one row per student)
-- ============================================================
create table fee_structures (
  id                  bigserial primary key,
  student_id          bigint unique not null references students(id) on delete cascade,
  payment_plan        payment_plan not null default 'Yearly',
  yearly_fee          numeric(10,2) not null,
  electricity_fee     numeric(10,2) not null default 0,
  non_refundable_fee  numeric(10,2) not null default 0,
  total_payable       numeric(10,2) not null,
  total_paid          numeric(10,2) not null default 0,
  balance_amount      numeric(10,2) not null,
  payment_status      payment_status not null default 'Pending',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id                bigserial primary key,
  student_id        bigint not null references students(id) on delete cascade,
  amount            numeric(10,2) not null check (amount > 0),
  payment_mode      payment_mode not null,
  payment_method    payment_method,
  payment_date      date not null,
  received_by       text not null,
  transaction_notes text,
  created_at        timestamptz not null default now()
);

create index idx_payments_student on payments(student_id);
create index idx_payments_date on payments(payment_date);

-- ============================================================
-- COMPLAINTS
-- ============================================================
create table complaints (
  id           bigserial primary key,
  student_id   bigint not null references students(id) on delete cascade,
  building_id  bigint references buildings(id) on delete set null,
  category     complaint_category not null,
  description  text not null,
  status       complaint_status not null default 'Unsolved',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_complaints_building on complaints(building_id);
create index idx_complaints_status on complaints(status);

-- ============================================================
-- ROOM CHANGE REQUESTS
-- ============================================================
create table room_change_requests (
  id                bigserial primary key,
  student_id        bigint not null references students(id) on delete cascade,
  current_bed_id    bigint references beds(id) on delete set null,
  requested_unit_id bigint references units(id) on delete set null,
  reason            text not null,
  status            room_change_status not null default 'Pending',
  created_at        timestamptz not null default now()
);

-- ============================================================
-- ANNOUNCEMENTS  (building_id null => global)
-- ============================================================
create table announcements (
  id           bigserial primary key,
  building_id  bigint references buildings(id) on delete cascade,
  title        text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);

create index idx_announcements_building on announcements(building_id);

-- ============================================================
-- FOOD MENU
-- ============================================================
create table food_menu (
  id           bigserial primary key,
  building_id  bigint references buildings(id) on delete cascade,
  day_of_week  text not null,
  meal_type    text not null check (meal_type in ('Breakfast','Lunch','Dinner')),
  items        text not null,
  unique (building_id, day_of_week, meal_type)
);

-- ============================================================
-- MAINTENANCE
-- ============================================================
create table maintenance (
  id            bigserial primary key,
  building_id   bigint references buildings(id) on delete set null,
  description   text not null,
  cost          numeric(10,2) not null,
  performed_on  date not null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_maintenance_building on maintenance(building_id);

-- ============================================================
-- ADMINS / STAFF
-- super_admin: role='super', assigned_building_id null
-- building staff: role='building_staff', assigned_building_id set
-- ============================================================
create table admins (
  id                    bigserial primary key,
  auth_user_id          uuid unique,
  mobile                text unique,
  username              text unique not null,
  name                  text,
  role                  admin_role not null default 'building_staff',
  assigned_building_id  bigint references buildings(id) on delete set null,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

create index idx_admins_building on admins(assigned_building_id);

-- ============================================================
-- TRIGGERS — keep updated_at fresh
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger trg_buildings_updated      before update on buildings      for each row execute function set_updated_at();
create trigger trg_students_updated       before update on students       for each row execute function set_updated_at();
create trigger trg_fee_structures_updated before update on fee_structures for each row execute function set_updated_at();
create trigger trg_complaints_updated     before update on complaints     for each row execute function set_updated_at();

-- ============================================================
-- HELPERS — recompute occupancy after a bed assignment change
-- ============================================================
create or replace function recompute_unit_occupancy(p_unit_id bigint)
returns void language plpgsql as $$
declare
  v_capacity   integer;
  v_occupied   integer;
  v_status     vacancy_status;
begin
  select count(*) into v_capacity from beds where unit_id = p_unit_id;
  select count(*) into v_occupied from beds where unit_id = p_unit_id and is_occupied;

  if v_occupied = 0 then
    v_status := 'Available';
  elsif v_occupied < v_capacity then
    v_status := 'Partially Occupied';
  else
    v_status := 'Occupied';
  end if;

  update units
     set capacity       = v_capacity,
         occupied_count = v_occupied,
         vacancy_status = v_status
   where id = p_unit_id;
end
$$;

create or replace function trg_bed_after_change()
returns trigger language plpgsql as $$
begin
  perform recompute_unit_occupancy(coalesce(new.unit_id, old.unit_id));
  return null;
end
$$;

create trigger trg_beds_recompute
after insert or update or delete on beds
for each row execute function trg_bed_after_change();

-- ============================================================
-- RLS — disabled for now; enable + add policies in 0003 once
-- the auth flow is wired and tested end-to-end.
-- ============================================================
-- alter table buildings           enable row level security;
-- alter table units               enable row level security;
-- alter table beds                enable row level security;
-- alter table students            enable row level security;
-- alter table fee_structures      enable row level security;
-- alter table payments            enable row level security;
-- alter table complaints          enable row level security;
-- alter table room_change_requests enable row level security;
-- alter table announcements       enable row level security;
-- alter table food_menu           enable row level security;
-- alter table maintenance         enable row level security;
-- alter table admins              enable row level security;
