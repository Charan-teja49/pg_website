import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, IndianRupee, Users, BedDouble, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useBuilding } from '../../lib/BuildingContext';
import {
  getBuildingAnalytics,
  getPerBuildingAnalytics,
  type BuildingAnalytics,
  type PerBuildingAnalytics,
} from '../../data/analytics';
import {
  fetchPaymentsForBuilding,
  type PaymentRowEnriched,
} from '../../data/payments';

interface MonthBucket {
  month: string;
  revenue: number;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function AdminAnalytics() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();

  const [analytics, setAnalytics] = useState<BuildingAnalytics | null>(null);
  const [perBuilding, setPerBuilding] = useState<PerBuildingAnalytics[] | null>(null);
  const [payments, setPayments] = useState<PaymentRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    Promise.all([
      getBuildingAnalytics(buildingId),
      isAllBuildings ? getPerBuildingAnalytics() : Promise.resolve(null),
      fetchPaymentsForBuilding(buildingId),
    ])
      .then(([a, perB, p]) => {
        if (cancelled) return;
        setAnalytics(a);
        setPerBuilding(perB);
        setPayments(p);
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

  const monthlyBuckets = useMemo<MonthBucket[]>(() => {
    // Group payments into buckets for the last 6 calendar months (including this one).
    const buckets: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        total: 0,
      });
    }
    payments.forEach((p) => {
      const d = new Date(p.payment_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.total += Number(p.amount);
    });
    return buckets.map((b) => ({ month: b.label, revenue: b.total }));
  }, [payments]);

  if (buildingLoading || (loading && !analytics)) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load analytics: {error}
      </div>
    );
  }
  if (!analytics) return null;

  const occupancyPct = analytics.totalBeds
    ? Math.round((analytics.occupiedBeds / analytics.totalBeds) * 100)
    : 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-3xl font-bold text-gray-800">Analytics &amp; Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAllBuildings
              ? 'Cross-building financial and occupancy view.'
              : `Detailed breakdown for ${current?.name ?? 'this building'}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          label="Revenue"
          value={`₹${analytics.totalRevenue.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          tone="text-emerald-700"
          tint="bg-emerald-50"
        />
        <KPICard
          label="Maintenance"
          value={`₹${analytics.totalExpenses.toLocaleString('en-IN')}`}
          icon={IndianRupee}
          tone="text-red-700"
          tint="bg-red-50"
        />
        <KPICard
          label={analytics.profit >= 0 ? 'Net profit' : 'Net loss'}
          value={`₹${Math.abs(analytics.profit).toLocaleString('en-IN')}`}
          icon={IndianRupee}
          tone={analytics.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}
          tint={analytics.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
        />
        <KPICard
          label="Occupancy"
          value={`${occupancyPct}%`}
          sub={`${analytics.occupiedBeds}/${analytics.totalBeds} beds`}
          icon={BedDouble}
          tone="text-[#B85138]"
          tint="bg-[#FBE6DD]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Monthly collections (last 6 months)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyBuckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#B85138" name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Payment status mix</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
            <PaymentStat
              label="Fully paid"
              count={analytics.fullyPaidCount}
              tone="bg-emerald-50"
              text="text-emerald-700"
            />
            <PaymentStat
              label="Partially"
              count={analytics.partiallyPaidCount}
              tone="bg-amber-50"
              text="text-amber-700"
            />
            <PaymentStat
              label="Pending"
              count={analytics.pendingCount}
              tone="bg-red-50"
              text="text-red-700"
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Stat
              icon={Users}
              label="Active students"
              value={analytics.totalStudents.toString()}
            />
            <Stat
              icon={AlertCircle}
              label="Pending due"
              value={`₹${analytics.pendingFeesAmount.toLocaleString('en-IN')}`}
              tone="text-red-700"
            />
          </div>
        </div>
      </div>

      {isAllBuildings && perBuilding && perBuilding.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Revenue by building</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={perBuilding.map((b) => ({
                short_name: b.short_name,
                revenue: b.totalRevenue,
                pending: b.pendingFeesAmount,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="short_name" />
              <YAxis />
              <Tooltip
                formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#B85138" name="Collected" />
              <Bar dataKey="pending" fill="#F2C8B5" name="Pending" />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Building</th>
                  <th className="py-2 pr-4 font-medium">Students</th>
                  <th className="py-2 pr-4 font-medium">Occupancy</th>
                  <th className="py-2 pr-4 font-medium">Revenue</th>
                  <th className="py-2 pr-4 font-medium">Pending</th>
                  <th className="py-2 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {perBuilding.map((b) => {
                  const pct = b.totalBeds
                    ? Math.round((b.occupiedBeds / b.totalBeds) * 100)
                    : 0;
                  return (
                    <tr key={b.code} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-800">
                        {b.short_name}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{b.totalStudents}</td>
                      <td className="py-3 pr-4 text-gray-700">
                        {b.occupiedBeds}/{b.totalBeds}{' '}
                        <span className="text-gray-400">({pct}%)</span>
                      </td>
                      <td className="py-3 pr-4 text-emerald-700">
                        ₹{b.totalRevenue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 pr-4 text-red-700">
                        ₹{b.pendingFeesAmount.toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`py-3 ${
                          b.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        ₹{b.profit.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${tone}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 ${tint} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${tone}`} />
        </div>
      </div>
    </div>
  );
}

function PaymentStat({
  label,
  count,
  tone,
  text,
}: {
  label: string;
  count: number;
  tone: string;
  text: string;
}) {
  return (
    <div className={`p-4 rounded-lg ${tone}`}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{count}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'text-gray-800',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
      <Icon className={`w-5 h-5 ${tone}`} />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`font-bold ${tone}`}>{value}</p>
      </div>
    </div>
  );
}
