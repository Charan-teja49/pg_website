import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase, pgError } from '../../lib/supabase';

interface MonthBucket {
  label: string; // 'Jan 26'
  total: number;
  count: number;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Lightweight bar chart of collections over the last N months, computed
 * from `payments`. No external charting library needed — uses styled div
 * widths instead.
 */
export default function MonthlyCollectionsChart({
  buildingId,
  months = 6,
}: {
  buildingId: number | null;
  months?: number;
}) {
  const [buckets, setBuckets] = useState<MonthBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Build the last N month buckets aligned to the 1st-of-month
        const now = new Date();
        const startMonth = new Date(
          now.getFullYear(),
          now.getMonth() - (months - 1),
          1,
        );
        const startIso = startMonth.toISOString().slice(0, 10);

        let q = supabase
          .from('payments')
          .select(
            'amount, payment_date, students!inner(building_id)',
          )
          .gte('payment_date', startIso);
        if (buildingId !== null) q = q.eq('students.building_id', buildingId);
        const { data, error: e } = await q;
        if (e) throw pgError(e, 'MonthlyCollectionsChart');

        const map = new Map<string, MonthBucket>();
        for (let i = 0; i < months; i++) {
          const d = new Date(
            startMonth.getFullYear(),
            startMonth.getMonth() + i,
            1,
          );
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
          map.set(key, { label, total: 0, count: 0 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of (data ?? []) as any[]) {
          const d = new Date(p.payment_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const bucket = map.get(key);
          if (bucket) {
            bucket.total += Number(p.amount);
            bucket.count += 1;
          }
        }
        if (!cancelled) setBuckets(Array.from(map.values()));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, months]);

  const max = buckets.reduce((m, b) => Math.max(m, b.total), 0) || 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#B85138]" />
          <h3 className="text-sm font-semibold text-gray-800">
            Monthly collections
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          last {months} months
        </span>
      </div>
      <div className="p-5">
        {loading && (
          <div className="text-sm text-gray-500 text-center py-6">
            Loading…
          </div>
        )}
        {error && (
          <div className="text-xs text-red-700 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="space-y-2">
            {buckets.map((b) => {
              const pct = (b.total / max) * 100;
              return (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">
                    {b.label}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-[#B85138] to-[#92402C] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-gray-700 font-medium">
                      ₹{b.total.toLocaleString('en-IN')}
                      {b.count > 0 && (
                        <span className="text-gray-400 ml-1">· {b.count}</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
