import { supabase, pgError } from '../lib/supabase';

export interface BedRow {
  id: number;
  unit_id: number;
  label: string;
  is_occupied: boolean;
  student_id: number | null;
  created_at: string;
}

export interface BedRowEnriched extends BedRow {
  unit_label: string;
  unit_type: string;
  building_id: number;
  building_short_name: string | null;
  student_name: string | null;
}

export async function fetchBedsForUnit(unitId: number): Promise<BedRow[]> {
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .eq('unit_id', unitId)
    .order('id');
  if (error) throw pgError(error, 'fetchBedsForUnit');
  return (data ?? []) as BedRow[];
}

/** Pass `null` to fetch every bed across every building. */
export async function fetchBedsForBuilding(
  buildingId: number | null,
): Promise<BedRowEnriched[]> {
  // beds.student_id -> students.id, name = fk_beds_student
  let q = supabase
    .from('beds')
    .select(
      '*, units!inner(building_id, label, type, buildings(short_name)), students!fk_beds_student(name)',
    )
    .order('id');
  if (buildingId !== null) q = q.eq('units.building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchBedsForBuilding');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((b) => ({
    ...b,
    unit_label: b.units.label,
    unit_type: b.units.type,
    building_id: b.units.building_id,
    building_short_name: b.units.buildings?.short_name ?? null,
    student_name: b.students?.name ?? null,
  }));
}

/** Only beds that are currently unassigned, for a building. */
export async function fetchAvailableBedsForBuilding(
  buildingId: number,
): Promise<BedRowEnriched[]> {
  const { data, error } = await supabase
    .from('beds')
    .select(
      '*, units!inner(building_id, label, type, buildings(short_name)), students!fk_beds_student(name)',
    )
    .eq('units.building_id', buildingId)
    .eq('is_occupied', false)
    .order('id');
  if (error) throw pgError(error, 'fetchAvailableBedsForBuilding');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((b) => ({
    ...b,
    unit_label: b.units.label,
    unit_type: b.units.type,
    building_id: b.units.building_id,
    building_short_name: b.units.buildings?.short_name ?? null,
    student_name: b.students?.name ?? null,
  }));
}

/**
 * Create a bed. If `label` is omitted, picks the next sequential 'Bed N'
 * based on the unit's current max suffix — robust against deletes that
 * left gaps.
 */
export async function createBed(
  unitId: number,
  label?: string,
): Promise<BedRow> {
  const finalLabel = label ?? `Bed ${(await maxBedNumberInUnit(unitId)) + 1}`;
  const { data, error } = await supabase
    .from('beds')
    .insert({ unit_id: unitId, label: finalLabel, is_occupied: false })
    .select()
    .single();
  if (error) throw pgError(error, 'createBed');
  return data as BedRow;
}

/**
 * Delete a bed AND renumber the remaining beds in the same unit so labels
 * stay contiguous (Bed 1, Bed 2, …). bed.id is unchanged, so any
 * student.bed_id reference stays valid — only the label moves.
 */
export async function deleteBed(id: number) {
  const { data: bed, error: lookupErr } = await supabase
    .from('beds')
    .select('unit_id')
    .eq('id', id)
    .maybeSingle();
  if (lookupErr) throw pgError(lookupErr, 'deleteBed.lookup');
  const unitId = bed?.unit_id;

  const { error: delErr } = await supabase.from('beds').delete().eq('id', id);
  if (delErr) throw pgError(delErr, 'deleteBed');

  if (unitId == null) return;
  await renumberBedsInUnit(unitId);
}

/** Rename beds in a unit so their labels are Bed 1, Bed 2, … in id order. */
export async function renumberBedsInUnit(unitId: number): Promise<void> {
  const { data, error } = await supabase
    .from('beds')
    .select('id, label')
    .eq('unit_id', unitId)
    .order('id', { ascending: true });
  if (error) throw pgError(error, 'renumberBedsInUnit.fetch');

  let n = 1;
  for (const row of data ?? []) {
    const expected = `Bed ${n}`;
    if (row.label !== expected) {
      const { error: uErr } = await supabase
        .from('beds')
        .update({ label: expected })
        .eq('id', row.id);
      if (uErr) throw pgError(uErr, 'renumberBedsInUnit.update');
    }
    n++;
  }
}

/** Highest 'Bed N' suffix among current beds in a unit. Returns 0 if none. */
async function maxBedNumberInUnit(unitId: number): Promise<number> {
  const { data, error } = await supabase
    .from('beds')
    .select('label')
    .eq('unit_id', unitId);
  if (error) throw pgError(error, 'maxBedNumberInUnit');
  let max = 0;
  for (const row of data ?? []) {
    const m = /(\d+)\s*$/.exec(row.label);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

export async function assignBedToStudent(bedId: number, studentId: number) {
  const { error: e1 } = await supabase
    .from('beds')
    .update({ is_occupied: true, student_id: studentId })
    .eq('id', bedId);
  if (e1) throw pgError(e1, 'assignBedToStudent.beds');
  const { error: e2 } = await supabase
    .from('students')
    .update({ bed_id: bedId })
    .eq('id', studentId);
  if (e2) throw pgError(e2, 'assignBedToStudent.students');
}

export async function unassignBed(bedId: number) {
  const { data: bed, error: e1 } = await supabase
    .from('beds')
    .select('student_id')
    .eq('id', bedId)
    .single();
  if (e1) throw pgError(e1, 'unassignBed.fetchBed');
  if (bed?.student_id) {
    const { error: e2 } = await supabase
      .from('students')
      .update({ bed_id: null })
      .eq('id', bed.student_id);
    if (e2) throw pgError(e2, 'unassignBed.clearStudent');
  }
  const { error: e3 } = await supabase
    .from('beds')
    .update({ is_occupied: false, student_id: null })
    .eq('id', bedId);
  if (e3) throw pgError(e3, 'unassignBed.clearBed');
}
