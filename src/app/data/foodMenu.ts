import { supabase, pgError } from '../lib/supabase';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface FoodMenuRow {
  id: number;
  building_id: number;
  day_of_week: string;
  meal_type: MealType;
  items: string;
}

export interface FoodMenuRowEnriched extends FoodMenuRow {
  building_short_name: string | null;
}

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};
const MEAL_ORDER: Record<MealType, number> = {
  Breakfast: 1,
  Lunch: 2,
  Dinner: 3,
};

/** Pass `null` for cross-building list. */
export async function fetchFoodMenu(
  buildingId: number | null,
): Promise<FoodMenuRowEnriched[]> {
  let q = supabase.from('food_menu').select('*, buildings(short_name)');
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchFoodMenu');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: FoodMenuRowEnriched[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    building_id: r.building_id,
    day_of_week: r.day_of_week,
    meal_type: r.meal_type as MealType,
    items: r.items,
    building_short_name: r.buildings?.short_name ?? null,
  }));
  rows.sort((a, b) => {
    const sn = (a.building_short_name ?? '').localeCompare(
      b.building_short_name ?? '',
    );
    if (sn !== 0) return sn;
    const dayDiff =
      (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return MEAL_ORDER[a.meal_type] - MEAL_ORDER[b.meal_type];
  });
  return rows;
}

export async function updateFoodMenuItems(id: number, items: string) {
  const { error } = await supabase
    .from('food_menu')
    .update({ items })
    .eq('id', id);
  if (error) throw pgError(error, 'updateFoodMenuItems');
}
