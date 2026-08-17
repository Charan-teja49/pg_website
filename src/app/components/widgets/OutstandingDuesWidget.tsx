import { useEffect, useState } from 'react';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { supabase, pgError } from '../../lib/supabase';
import { whatsappLink, feeReminderMessage } from '../../lib/whatsapp';
import BuildingTag from '../BuildingTag';

interface DueRow {
  id: number;
  name: string;
  mobile: string;
  building_id: number;
  building_short_name: string | null;
  balance_amount: number;
  payment_status: string;
}

/**
 * Top-N students with highest outstanding balance. Tap any row to ping
 * them on WhatsApp with a pre-filled reminder.
 */
export default function OutstandingDuesWidget({
  buildingId,
  limit = 8,
}: {
  buildingId: number | null;
  limit?: number;
}) {
  const [rows, setRows] = useState<DueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let q = supabase
          .from('fee_structures')
          .select(
            'balance_amount, payment_status, students!inner(id, name, mobile, building_id, buildings(short_name))',
          )
          .gt('balance_amount', 0)
          .order('balance_amount', { ascending: false })
          .limit(limit);
        if (buildingId !== null) {
          q = q.eq('students.building_id', buildingId);
        }
        const { data, error: e } = await q;
        if (e) throw pgError(e, 'OutstandingDuesWidget.fees');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: DueRow[] = ((data ?? []) as any[]).map((f) => ({
          id: f.students.id,
          name: f.students.name,
          mobile: f.students.mobile,
          building_id: f.students.building_id,
          building_short_name: f.students.buildings?.short_name ?? null,
          balance_amount: Number(f.balance_amount),
          payment_status: f.payment_status,
        }));
        if (!cancelled) setRows(mapped);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, limit]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-semibold text-gray-800">
            Outstanding dues
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          top {limit}
        </span>
      </div>
      <div className="p-2">
        {loading && (
          <div className="px-3 py-6 text-sm text-gray-500 text-center">
            Loading…
          </div>
        )}
        {error && (
          <div className="px-3 py-4 text-xs text-red-700 bg-red-50 mx-2 my-2 rounded">
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="px-3 py-6 text-sm text-emerald-700 text-center">
            ✓ All students fully paid.
          </div>
        )}
        {!loading &&
          !error &&
          rows.map((r) => {
            const wa = whatsappLink(
              r.mobile,
              feeReminderMessage(
                r.name,
                r.balance_amount,
                r.building_short_name ?? '',
              ),
            );
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.name}
                    </p>
                    {buildingId === null && (
                      <BuildingTag shortName={r.building_short_name} />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.payment_status} · {r.mobile}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-700">
                    ₹{r.balance_amount.toLocaleString('en-IN')}
                  </p>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#0F766E] hover:underline mt-0.5"
                    title={`Remind ${r.name} via WhatsApp`}
                  >
                    <MessageCircle className="w-3 h-3" />
                    remind
                  </a>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
