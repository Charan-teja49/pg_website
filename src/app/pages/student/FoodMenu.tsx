import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { UtensilsCrossed } from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import {
  fetchFoodMenu,
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

export default function StudentFoodMenu() {
  const navigate = useNavigate();
  const [, setUser] = useState<AppUser | null>(null);
  const [menu, setMenu] = useState<FoodMenuRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const u = await getCurrentUser();
        if (!u || u.role !== 'student') {
          navigate('/student/login');
          return;
        }
        if (cancelled) return;
        setUser(u);

        if (u.buildingId === null) {
          setMenu([]);
          return;
        }

        const rows = await fetchFoodMenu(u.buildingId);
        if (!cancelled) setMenu(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Build a map: day -> meal -> items
  const grid = useMemo(() => {
    const map = new Map<string, Map<MealType, string>>();
    for (const row of menu) {
      const dayMap = map.get(row.day_of_week) ?? new Map<MealType, string>();
      dayMap.set(row.meal_type, row.items);
      map.set(row.day_of_week, dayMap);
    }
    return map;
  }, [menu]);

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load food menu: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <UtensilsCrossed className="w-8 h-8 text-[#B85138]" />
        <h1 className="text-3xl font-bold text-gray-800">Weekly Food Menu</h1>
      </div>

      <div className="bg-[#FBE6DD] border border-[#FBE6DD] rounded-lg p-4 mb-6">
        <p className="text-sm text-[#92402C]">
          Food is served three times a day. Timings: Breakfast (7:00 AM - 9:00 AM),
          Lunch (12:00 PM - 2:00 PM), Dinner (7:00 PM - 9:00 PM)
        </p>
      </div>

      {menu.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-600">
          No menu has been published for your building yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="py-3 px-4 font-medium w-32">Day</th>
                  {MEALS.map((meal) => (
                    <th key={meal} className="py-3 px-4 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            meal === 'Breakfast'
                              ? 'bg-[#B85138]'
                              : meal === 'Lunch'
                                ? 'bg-[#0F766E]'
                                : 'bg-amber-500'
                          }`}
                        />
                        {meal}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => {
                  const dayMap = grid.get(day);
                  return (
                    <tr
                      key={day}
                      className="border-t border-gray-100 align-top"
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {day}
                      </td>
                      {MEALS.map((meal) => (
                        <td key={meal} className="py-3 px-4 text-gray-700">
                          {dayMap?.get(meal) ?? (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Menu Legend</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#B85138] rounded-full" />
            <span className="text-sm text-gray-700">Breakfast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#0F766E] rounded-full" />
            <span className="text-sm text-gray-700">Lunch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-sm text-gray-700">Dinner</span>
          </div>
        </div>
      </div>
    </div>
  );
}
