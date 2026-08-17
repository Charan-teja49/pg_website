import { supabase, pgError } from '../lib/supabase';
import type { BuildingRow } from '../lib/BuildingContext';

export type { BuildingRow };

export async function fetchBuildings(): Promise<BuildingRow[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select(
      'id, code, name, short_name, yearly_fee, electricity_fee, non_refundable_fee, planned_capacity',
    )
    .order('id');
  if (error) throw pgError(error, 'fetchBuildings');
  return (data ?? []) as BuildingRow[];
}

export async function updateBuildingFees(
  id: number,
  fees: { yearly_fee: number; electricity_fee: number; non_refundable_fee: number },
) {
  const { error } = await supabase.from('buildings').update(fees).eq('id', id);
  if (error) throw pgError(error, 'updateBuildingFees');
}
