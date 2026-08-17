import { supabase, pgError } from '../lib/supabase';

export type UnitType = 'floor' | 'flat' | 'room' | 'villa' | 'other';
export type VacancyStatus = 'Available' | 'Partially Occupied' | 'Occupied';

export interface UnitRow {
  id: number;
  building_id: number;
  parent_unit_id: number | null;
  type: UnitType;
  label: string;
  capacity: number;
  occupied_count: number;
  vacancy_status: VacancyStatus;
  notes: string | null;
  created_at: string;
}

export interface UnitRowWithBuilding extends UnitRow {
  building_short_name: string | null;
}

/** Pass `null` for cross-building list. */
export async function fetchUnits(
  buildingId: number | null,
): Promise<UnitRowWithBuilding[]> {
  let q = supabase
    .from('units')
    .select('*, buildings(short_name)')
    .order('id');
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchUnits');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((u) => ({
    ...u,
    building_short_name: u.buildings?.short_name ?? null,
  }));
}

/** Leaf units = units that have beds attached. */
export async function fetchLeafUnits(
  buildingId: number | null,
): Promise<UnitRowWithBuilding[]> {
  let q = supabase
    .from('units')
    .select('*, buildings(short_name), beds!inner(id)')
    .order('id');
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchLeafUnits');
  const seen = new Set<number>();
  const out: UnitRowWithBuilding[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const { beds: _b, buildings, ...rest } = row;
    out.push({ ...rest, building_short_name: buildings?.short_name ?? null });
  }
  return out;
}

export async function createUnit(input: {
  building_id: number;
  parent_unit_id: number | null;
  type: UnitType;
  label: string;
  capacity?: number;
}): Promise<UnitRow> {
  const { data, error } = await supabase
    .from('units')
    .insert({ ...input, capacity: input.capacity ?? 0 })
    .select()
    .single();
  if (error) throw pgError(error, 'createUnit');
  return data as UnitRow;
}

export async function updateUnit(id: number, patch: Partial<UnitRow>) {
  const { error } = await supabase.from('units').update(patch).eq('id', id);
  if (error) throw pgError(error, 'updateUnit');
}

export async function deleteUnit(id: number) {
  const { error } = await supabase.from('units').delete().eq('id', id);
  if (error) throw pgError(error, 'deleteUnit');
}

// =====================================================================
// Structure summary + bulk-create helpers used by the Building Settings
// page. Bulk-create is NOT transactional — if it fails midway, partial
// units may remain; the admin can re-run with the remaining count or
// clean up via the Rooms page.
// =====================================================================

export interface BuildingStructureCounts {
  building_id: number;
  floors: number;
  flats: number;
  rooms: number;
  villas: number;
  other: number;
  beds_total: number;
  beds_occupied: number;
}

export async function getBuildingStructure(
  buildingId: number,
): Promise<BuildingStructureCounts> {
  const { data: unitRows, error: uErr } = await supabase
    .from('units')
    .select('id, type')
    .eq('building_id', buildingId);
  if (uErr) throw pgError(uErr, 'getBuildingStructure.units');

  const { data: bedRows, error: bErr } = await supabase
    .from('beds')
    .select('id, is_occupied, units!inner(building_id)')
    .eq('units.building_id', buildingId);
  if (bErr) throw pgError(bErr, 'getBuildingStructure.beds');

  const counts: BuildingStructureCounts = {
    building_id: buildingId,
    floors: 0,
    flats: 0,
    rooms: 0,
    villas: 0,
    other: 0,
    beds_total: bedRows?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beds_occupied: (bedRows ?? []).filter((b: any) => b.is_occupied).length,
  };
  for (const u of unitRows ?? []) {
    const t = u.type as UnitType;
    if (t === 'floor') counts.floors++;
    else if (t === 'flat') counts.flats++;
    else if (t === 'room') counts.rooms++;
    else if (t === 'villa') counts.villas++;
    else counts.other++;
  }
  return counts;
}

/**
 * Find the highest numeric suffix in an existing set of labels matching a
 * given prefix. Used so newly-added flats/villas continue the sequence
 * rather than colliding. Returns 0 if none match.
 *
 *   labels = ['F-001','F-002','F-049'] + prefix='F-' → 49
 */
function maxLabelNumber(labels: string[], prefix: string): number {
  let max = 0;
  for (const l of labels) {
    if (!l.startsWith(prefix)) continue;
    const n = Number(l.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * For Chalapathi-like buildings (flat is the leaf, no floor/room nesting).
 * Creates `count` new flats with `bedsPerFlat` beds each. Labels continue
 * the F-### sequence using zero-padding to width 3.
 */
export async function addFlats(
  buildingId: number,
  count: number,
  bedsPerFlat: number,
): Promise<{ flatsCreated: number; bedsCreated: number }> {
  if (count <= 0 || bedsPerFlat <= 0) {
    return { flatsCreated: 0, bedsCreated: 0 };
  }
  const { data: existing, error } = await supabase
    .from('units')
    .select('label')
    .eq('building_id', buildingId)
    .eq('type', 'flat');
  if (error) throw pgError(error, 'addFlats.existing');
  const start = maxLabelNumber((existing ?? []).map((r) => r.label), 'F-');

  let flatsCreated = 0;
  let bedsCreated = 0;
  for (let i = 1; i <= count; i++) {
    const label = `F-${String(start + i).padStart(3, '0')}`;
    const flat = await createUnit({
      building_id: buildingId,
      parent_unit_id: null,
      type: 'flat',
      label,
      capacity: bedsPerFlat,
    });
    flatsCreated++;
    for (let b = 1; b <= bedsPerFlat; b++) {
      const { error: bErr } = await supabase
        .from('beds')
        .insert({ unit_id: flat.id, label: `Bed ${b}`, is_occupied: false });
      if (bErr) throw pgError(bErr, 'addFlats.beds');
      bedsCreated++;
    }
  }
  return { flatsCreated, bedsCreated };
}

/**
 * For Villas-like buildings (villa is the leaf).
 * Creates `count` new villas labelled `Villa-N+1..` with `bedsPerVilla`
 * beds each.
 */
export async function addVillas(
  buildingId: number,
  count: number,
  bedsPerVilla: number,
): Promise<{ villasCreated: number; bedsCreated: number }> {
  if (count <= 0 || bedsPerVilla <= 0) {
    return { villasCreated: 0, bedsCreated: 0 };
  }
  const { data: existing, error } = await supabase
    .from('units')
    .select('label')
    .eq('building_id', buildingId)
    .eq('type', 'villa');
  if (error) throw pgError(error, 'addVillas.existing');
  const start = maxLabelNumber(
    (existing ?? []).map((r) => r.label),
    'Villa-',
  );

  let villasCreated = 0;
  let bedsCreated = 0;
  for (let i = 1; i <= count; i++) {
    const label = `Villa-${start + i}`;
    const v = await createUnit({
      building_id: buildingId,
      parent_unit_id: null,
      type: 'villa',
      label,
      capacity: bedsPerVilla,
    });
    villasCreated++;
    for (let b = 1; b <= bedsPerVilla; b++) {
      const { error: bErr } = await supabase
        .from('beds')
        .insert({ unit_id: v.id, label: `Bed ${b}`, is_occupied: false });
      if (bErr) throw pgError(bErr, 'addVillas.beds');
      bedsCreated++;
    }
  }
  return { villasCreated, bedsCreated };
}

/**
 * For Stanza / Siddha-like buildings (floor → flat → room → bed).
 * Adds ONE new floor with `flatsPerFloor` × `roomsPerFlat` × `bedsPerRoom`
 * leaves under it. Labels continue from the existing max floor number.
 *
 * Label scheme:
 *   floor:  Floor-N
 *   flat:   <floorLetter|prefix>-NA, NB, …  (uppercase A,B,…)
 *   room:   <flatLabel>-R1, R2, …
 *   bed:    Bed 1, 2, …
 *
 * The flat prefix is the building's first letter uppercased (S- for
 * Stanza, D- for Siddha) to keep label collisions impossible across
 * buildings.
 */
export async function addFloorStack(
  buildingId: number,
  flatsPerFloor: number,
  roomsPerFlat: number,
  bedsPerRoom: number,
  flatPrefix = 'S',
): Promise<{
  floorsCreated: number;
  flatsCreated: number;
  roomsCreated: number;
  bedsCreated: number;
}> {
  if (flatsPerFloor <= 0 || roomsPerFlat <= 0 || bedsPerRoom <= 0) {
    return { floorsCreated: 0, flatsCreated: 0, roomsCreated: 0, bedsCreated: 0 };
  }
  const { data: existingFloors, error } = await supabase
    .from('units')
    .select('label')
    .eq('building_id', buildingId)
    .eq('type', 'floor');
  if (error) throw pgError(error, 'addFloorStack.existingFloors');

  const nextFloorNum =
    maxLabelNumber((existingFloors ?? []).map((r) => r.label), 'Floor-') + 1;

  const floor = await createUnit({
    building_id: buildingId,
    parent_unit_id: null,
    type: 'floor',
    label: `Floor-${nextFloorNum}`,
    capacity: flatsPerFloor * roomsPerFlat * bedsPerRoom,
  });
  let flatsCreated = 0;
  let roomsCreated = 0;
  let bedsCreated = 0;

  for (let f = 1; f <= flatsPerFloor; f++) {
    const flatLetter = String.fromCharCode(64 + f); // A, B, C…
    const flat = await createUnit({
      building_id: buildingId,
      parent_unit_id: floor.id,
      type: 'flat',
      label: `${flatPrefix}-${nextFloorNum}${flatLetter}`,
      capacity: roomsPerFlat * bedsPerRoom,
    });
    flatsCreated++;

    for (let r = 1; r <= roomsPerFlat; r++) {
      const room = await createUnit({
        building_id: buildingId,
        parent_unit_id: flat.id,
        type: 'room',
        label: `${flatPrefix}-${nextFloorNum}${flatLetter}-R${r}`,
        capacity: bedsPerRoom,
      });
      roomsCreated++;

      for (let b = 1; b <= bedsPerRoom; b++) {
        const { error: bErr } = await supabase
          .from('beds')
          .insert({ unit_id: room.id, label: `Bed ${b}`, is_occupied: false });
        if (bErr) throw pgError(bErr, 'addFloorStack.beds');
        bedsCreated++;
      }
    }
  }

  return { floorsCreated: 1, flatsCreated, roomsCreated, bedsCreated };
}

export async function updatePlannedCapacity(
  buildingId: number,
  planned_capacity: number,
) {
  const { error } = await supabase
    .from('buildings')
    .update({ planned_capacity })
    .eq('id', buildingId);
  if (error) throw pgError(error, 'updatePlannedCapacity');
}
