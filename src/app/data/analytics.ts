import { supabase, pgError } from '../lib/supabase';

export interface BuildingAnalytics {
  buildingId: number | null; // null = aggregate across all buildings
  totalStudents: number;
  totalUnits: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingPaymentsCount: number;
  pendingFeesAmount: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
}

export interface PerBuildingAnalytics extends BuildingAnalytics {
  short_name: string;
  code: string;
}

/** Pass `null` to aggregate across every building. */
export async function getBuildingAnalytics(
  buildingId: number | null,
): Promise<BuildingAnalytics> {
  const [studentsRes, bedsRes, unitsRes, feesRes, maintRes] = await Promise.all([
    buildingId === null
      ? supabase.from('students').select('id', { count: 'exact', head: true })
      : supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', buildingId),

    buildingId === null
      ? supabase.from('beds').select('id, is_occupied')
      : supabase
          .from('beds')
          .select('id, is_occupied, units!inner(building_id)')
          .eq('units.building_id', buildingId),

    buildingId === null
      ? supabase.from('units').select('id', { count: 'exact', head: true })
      : supabase
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', buildingId),

    buildingId === null
      ? supabase
          .from('fee_structures')
          .select('total_paid, balance_amount, payment_status')
      : supabase
          .from('fee_structures')
          .select(
            'total_paid, balance_amount, payment_status, students!inner(building_id)',
          )
          .eq('students.building_id', buildingId),

    buildingId === null
      ? supabase.from('maintenance').select('cost')
      : supabase.from('maintenance').select('cost').eq('building_id', buildingId),
  ]);

  if (studentsRes.error) throw pgError(studentsRes.error, 'analytics.students');
  if (bedsRes.error) throw pgError(bedsRes.error, 'analytics.beds');
  if (unitsRes.error) throw pgError(unitsRes.error, 'analytics.units');
  if (feesRes.error) throw pgError(feesRes.error, 'analytics.fees');
  if (maintRes.error) throw pgError(maintRes.error, 'analytics.maintenance');

  const totalStudents = studentsRes.count ?? 0;
  const totalUnits = unitsRes.count ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bedRows = (bedsRes.data ?? []) as any[];
  const totalBeds = bedRows.length;
  const occupiedBeds = bedRows.filter((b) => b.is_occupied).length;
  const availableBeds = totalBeds - occupiedBeds;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeRows = (feesRes.data ?? []) as any[];
  const totalRevenue = feeRows.reduce((s, f) => s + Number(f.total_paid ?? 0), 0);
  const pendingFeesAmount = feeRows.reduce(
    (s, f) => s + Number(f.balance_amount ?? 0),
    0,
  );
  const fullyPaidCount = feeRows.filter(
    (f) => f.payment_status === 'Fully Paid',
  ).length;
  const partiallyPaidCount = feeRows.filter(
    (f) => f.payment_status === 'Partially Paid',
  ).length;
  const pendingCount = feeRows.filter(
    (f) => f.payment_status === 'Pending',
  ).length;
  const pendingPaymentsCount = partiallyPaidCount + pendingCount;

  const totalExpenses = (maintRes.data ?? []).reduce(
    (s, m: { cost: number }) => s + Number(m.cost ?? 0),
    0,
  );
  const profit = totalRevenue - totalExpenses;

  return {
    buildingId,
    totalStudents,
    totalUnits,
    totalBeds,
    occupiedBeds,
    availableBeds,
    totalRevenue,
    totalExpenses,
    profit,
    pendingPaymentsCount,
    pendingFeesAmount,
    fullyPaidCount,
    partiallyPaidCount,
    pendingCount,
  };
}

/** Returns one analytics row per building. */
export async function getPerBuildingAnalytics(): Promise<PerBuildingAnalytics[]> {
  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('id, code, short_name')
    .order('id');
  if (error) throw pgError(error, 'getPerBuildingAnalytics');

  const list = (buildings ?? []) as { id: number; code: string; short_name: string }[];
  const results = await Promise.all(
    list.map(async (b) => {
      const a = await getBuildingAnalytics(b.id);
      return { ...a, code: b.code, short_name: b.short_name };
    }),
  );
  return results;
}
