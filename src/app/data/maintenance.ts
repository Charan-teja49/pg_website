import { supabase, pgError } from '../lib/supabase';

export interface MaintenanceRow {
  id: number;
  building_id: number | null;
  description: string;
  cost: number;
  performed_on: string;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceRowEnriched extends MaintenanceRow {
  building_short_name: string | null;
}

/** Pass `null` for cross-building list. */
export async function fetchMaintenance(
  buildingId: number | null,
): Promise<MaintenanceRowEnriched[]> {
  let q = supabase
    .from('maintenance')
    .select('*, buildings(short_name)')
    .order('performed_on', { ascending: false });
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchMaintenance');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((m) => ({
    ...m,
    building_short_name: m.buildings?.short_name ?? null,
  }));
}

export async function createMaintenance(input: {
  building_id: number | null;
  description: string;
  cost: number;
  performed_on: string;
  notes?: string | null;
}): Promise<MaintenanceRow> {
  const { data, error } = await supabase
    .from('maintenance')
    .insert(input)
    .select()
    .single();
  if (error) throw pgError(error, 'createMaintenance');
  return data as MaintenanceRow;
}

export async function deleteMaintenance(id: number) {
  const { error } = await supabase.from('maintenance').delete().eq('id', id);
  if (error) throw pgError(error, 'deleteMaintenance');
}
