-- PG — Hostel Management
-- Migration 0002: seed the 4 buildings + their unit/bed hierarchy.
-- Run after 0001_init.sql on a fresh project.

-- ============================================================
-- BUILDINGS
-- ============================================================
insert into buildings (code, name, short_name, yearly_fee, electricity_fee, non_refundable_fee, planned_capacity, hierarchy)
values
  ('chalapathi-main', 'Chalapathi Main Building', 'Chalapathi', 95000, 5000, 2000, 300,
    '{"has_floors":false,"has_flats":true,"has_villas":false,"has_rooms_in_flats":false,"beds_per_unit":6}'::jsonb),
  ('stanza',          'Stanza',                   'Stanza',     85000,    0, 2000,  60,
    '{"has_floors":true,"has_flats":true,"has_villas":false,"has_rooms_in_flats":true,"beds_per_unit":3}'::jsonb),
  ('villas',          'Villas',                   'Villas',    100000,    0, 2000,  60,
    '{"has_floors":false,"has_flats":false,"has_villas":true,"has_rooms_in_flats":false,"beds_per_unit":15}'::jsonb),
  ('siddha-middle',   'Siddha Middle Block',      'Siddha',     85000, 5000, 2000,   0,
    '{"has_floors":true,"has_flats":true,"has_villas":false,"has_rooms_in_flats":true,"beds_per_unit":3}'::jsonb);

-- ============================================================
-- CHALAPATHI MAIN — 50 flats × 6 beds each = 300 beds
-- Flat labels: F-001 .. F-050
-- ============================================================
do $$
declare
  v_building_id bigint;
  v_flat_id     bigint;
  i             integer;
  j             integer;
begin
  select id into v_building_id from buildings where code = 'chalapathi-main';

  for i in 1..50 loop
    insert into units (building_id, type, label, capacity)
      values (v_building_id, 'flat', 'F-' || lpad(i::text, 3, '0'), 6)
      returning id into v_flat_id;

    for j in 1..6 loop
      insert into beds (unit_id, label) values (v_flat_id, 'Bed ' || j);
    end loop;
  end loop;
end
$$;

-- ============================================================
-- STANZA — 5 floors × 2 flats × 2 rooms × 3 beds = 60 beds
-- Labels:
--   floor: Floor-1 .. Floor-5
--   flat:  S-1A, S-1B, S-2A, S-2B ...
--   room:  S-1A-R1, S-1A-R2 ...
-- ============================================================
do $$
declare
  v_building_id bigint;
  v_floor_id    bigint;
  v_flat_id     bigint;
  v_room_id     bigint;
  v_floor       integer;
  v_flat_idx    integer;
  v_room_idx    integer;
  v_bed_idx     integer;
  v_flat_letter text;
begin
  select id into v_building_id from buildings where code = 'stanza';

  for v_floor in 1..5 loop
    insert into units (building_id, type, label, capacity)
      values (v_building_id, 'floor', 'Floor-' || v_floor, 12)
      returning id into v_floor_id;

    for v_flat_idx in 1..2 loop
      v_flat_letter := chr(64 + v_flat_idx); -- 'A','B'
      insert into units (building_id, parent_unit_id, type, label, capacity)
        values (v_building_id, v_floor_id, 'flat',
                'S-' || v_floor || v_flat_letter, 6)
        returning id into v_flat_id;

      for v_room_idx in 1..2 loop
        insert into units (building_id, parent_unit_id, type, label, capacity)
          values (v_building_id, v_flat_id, 'room',
                  'S-' || v_floor || v_flat_letter || '-R' || v_room_idx, 3)
          returning id into v_room_id;

        for v_bed_idx in 1..3 loop
          insert into beds (unit_id, label) values (v_room_id, 'Bed ' || v_bed_idx);
        end loop;
      end loop;
    end loop;
  end loop;
end
$$;

-- ============================================================
-- VILLAS — 4 villas × 15 beds = 60 beds
-- ============================================================
do $$
declare
  v_building_id bigint;
  v_villa_id    bigint;
  i             integer;
  j             integer;
begin
  select id into v_building_id from buildings where code = 'villas';

  for i in 1..4 loop
    insert into units (building_id, type, label, capacity)
      values (v_building_id, 'villa', 'Villa-' || i, 15)
      returning id into v_villa_id;

    for j in 1..15 loop
      insert into beds (unit_id, label) values (v_villa_id, 'Bed ' || j);
    end loop;
  end loop;
end
$$;

-- ============================================================
-- SIDDHA MIDDLE BLOCK — capacity TBD by client.
-- We seed only the building row (above). Admin will build the
-- hierarchy via the Buildings settings page.
-- ============================================================

-- ============================================================
-- DEFAULT FOOD MENU stub (one row per building × day × meal)
-- ============================================================
do $$
declare
  b record;
  d text;
  m text;
begin
  for b in select id from buildings loop
    foreach d in array array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] loop
      foreach m in array array['Breakfast','Lunch','Dinner'] loop
        insert into food_menu (building_id, day_of_week, meal_type, items)
          values (b.id, d, m, '—');
      end loop;
    end loop;
  end loop;
end
$$;

-- ============================================================
-- DEFAULT SUPER ADMIN
-- Username '12345' to match the legacy demo creds. The password
-- is set via Supabase Auth (see supabase/README.md). This row
-- only carries the role + name; auth_user_id is filled later.
-- ============================================================
insert into admins (username, mobile, name, role)
values ('12345', '0000012345', 'Super Admin', 'super');
