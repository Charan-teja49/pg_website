import { useEffect, useMemo, useState } from 'react';
import { Edit, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchFoodMenu,
  updateFoodMenuItems,
  type FoodMenuRowEnriched,
  type MealType,
} from '../../data/foodMenu';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const MEALS: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

export default function AdminFoodMenu() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [menu, setMenu] = useState<FoodMenuRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchFoodMenu(buildingId)
      .then((rows) => {
        if (!cancelled) setMenu(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingLoading, isAllBuildings, current?.id]);

  const handleEdit = (row: FoodMenuRowEnriched) => {
    setEditingId(row.id);
    setEditValue(row.items);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSave = async (id: number) => {
    setSaving(true);
    try {
      await updateFoodMenuItems(id, editValue);
      setMenu((prev) =>
        prev.map((m) => (m.id === id ? { ...m, items: editValue } : m)),
      );
      setEditingId(null);
      setEditValue('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // Group by building → day → meal_type
  const grouped = useMemo(() => {
    const out = new Map<string, FoodMenuRowEnriched[]>();
    menu.forEach((row) => {
      const key = `${row.building_id}|${row.building_short_name ?? ''}`;
      const list = out.get(key) ?? [];
      list.push(row);
      out.set(key, list);
    });
    return Array.from(out.entries()).map(([key, rows]) => {
      const [, shortName] = key.split('|');
      return { buildingShortName: shortName, rows };
    });
  }, [menu]);

  if (buildingLoading || (loading && menu.length === 0)) {
    return <div className="text-gray-600">Loading…</div>;
  }

  const findCell = (rows: FoodMenuRowEnriched[], day: string, meal: MealType) =>
    rows.find((r) => r.day_of_week === day && r.meal_type === meal);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
            Food Menu Management
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load menu: {error}
        </div>
      )}

      <div className="bg-[#FBE6DD] border border-[#F2C8B5] rounded-lg p-4 mb-6">
        <p className="text-sm text-[#92402C]">
          Click the edit icon to modify menu items. Changes will be visible to
          students immediately.
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500 text-sm">
          No menu items yet for this building.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ buildingShortName, rows }) => (
            <div key={buildingShortName}>
              {isAllBuildings && (
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {buildingShortName || 'Building'}
                  </h2>
                  <BuildingTag shortName={buildingShortName} />
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                        Day
                      </th>
                      {MEALS.map((meal) => (
                        <th
                          key={meal}
                          className="text-left py-3 px-4 text-sm font-medium text-gray-700"
                        >
                          {meal}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-4 text-sm font-medium text-gray-800">
                          {day}
                        </td>
                        {MEALS.map((meal) => {
                          const cell = findCell(rows, day, meal);
                          if (!cell) {
                            return (
                              <td
                                key={meal}
                                className="py-3 px-4 text-sm text-gray-400"
                              >
                                —
                              </td>
                            );
                          }
                          const isEditing = editingId === cell.id;
                          return (
                            <td key={meal} className="py-3 px-4 align-top">
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <textarea
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                                    rows={3}
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleSave(cell.id)}
                                      disabled={saving}
                                      className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={handleCancel}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start gap-2">
                                  <p className="text-sm text-gray-700 flex-1 whitespace-pre-line">
                                    {cell.items}
                                  </p>
                                  <button
                                    onClick={() => handleEdit(cell)}
                                    className="p-1 text-[#B85138] hover:bg-[#FBE6DD] rounded shrink-0"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
