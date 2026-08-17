import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Users,
  Building,
  IndianRupee,
  AlertCircle,
  BedDouble,
  Bell,
  Wrench,
} from 'lucide-react';
import { useBuilding } from '../../lib/BuildingContext';
import {
  getBuildingAnalytics,
  getPerBuildingAnalytics,
  type BuildingAnalytics,
  type PerBuildingAnalytics,
} from '../../data/analytics';
import ActivityFeed from '../../components/ActivityFeed';

export default function AdminDashboard() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [analytics, setAnalytics] = useState<BuildingAnalytics | null>(null);
  const [perBuilding, setPerBuilding] = useState<PerBuildingAnalytics[] | null>(null);
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
    ])
      .then(([a, perB]) => {
        if (cancelled) return;
        setAnalytics(a);
        setPerBuilding(perB);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingLoading, isAllBuildings, current?.id]);

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
  const profitPositive = analytics.profit >= 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
            Dashboard Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAllBuildings
              ? 'Aggregate metrics across every building.'
              : `Metrics for ${current?.name ?? 'this building'}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          label="Students"
          value={analytics.totalStudents.toString()}
          sub={`${analytics.totalUnits} units`}
          icon={Users}
          iconBg="bg-[#FBE6DD]"
          iconColor="text-[#B85138]"
        />
        <KPICard
          label="Occupancy"
          value={`${analytics.occupiedBeds}/${analytics.totalBeds}`}
          sub={`${occupancyPct}% · ${analytics.availableBeds} beds free`}
          icon={BedDouble}
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
        />
        <KPICard
          label="Revenue"
          value={`₹${analytics.totalRevenue.toLocaleString('en-IN')}`}
          sub={profitPositive ? 'Net positive' : 'Net loss'}
          icon={IndianRupee}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <KPICard
          label="Pending payments"
          value={analytics.pendingPaymentsCount.toString()}
          sub={`₹${analytics.pendingFeesAmount.toLocaleString('en-IN')} due`}
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-700"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <MoneyCard label="Revenue collected" value={analytics.totalRevenue} color="text-emerald-700" />
        <MoneyCard label="Maintenance spend" value={analytics.totalExpenses} color="text-red-700" />
        <MoneyCard
          label={profitPositive ? 'Net profit' : 'Net loss'}
          value={Math.abs(analytics.profit)}
          color={profitPositive ? 'text-emerald-700' : 'text-red-700'}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Payment status mix</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <PaymentStat label="Fully paid" count={analytics.fullyPaidCount} tone="bg-emerald-50" text="text-emerald-700" />
          <PaymentStat label="Partially paid" count={analytics.partiallyPaidCount} tone="bg-amber-50" text="text-amber-700" />
          <PaymentStat label="Pending" count={analytics.pendingCount} tone="bg-red-50" text="text-red-700" />
        </div>
      </div>

      {isAllBuildings && perBuilding && perBuilding.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Per-building snapshot</h2>
            <span className="text-xs text-gray-500">
              {perBuilding.length} buildings
            </span>
          </div>
          <div className="overflow-x-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed
            buildingId={isAllBuildings ? null : current?.id ?? null}
            showBuildingTag={isAllBuildings}
            limit={10}
          />
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">Quick actions</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Jump straight to common tasks
            </p>
          </div>
          <div className="p-3 grid grid-cols-1 gap-2">
            <QuickActionTile
              to="/admin/students"
              icon={Users}
              iconBg="bg-[#FBE6DD]"
              iconColor="text-[#B85138]"
              label="Add student"
              subtitle="Onboard new admission"
            />
            <QuickActionTile
              to="/admin/payments"
              icon={IndianRupee}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-700"
              label="Record payment"
              subtitle="Log a fee collection"
            />
            <QuickActionTile
              to="/admin/announcements"
              icon={Bell}
              iconBg="bg-amber-50"
              iconColor="text-amber-700"
              label="Post notice"
              subtitle="Share a new announcement"
            />
            <QuickActionTile
              to="/admin/maintenance"
              icon={Wrench}
              iconBg="bg-blue-50"
              iconColor="text-blue-700"
              label="Log expense"
              subtitle="Record maintenance spend"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionTile({
  to,
  icon: Icon,
  iconBg,
  iconColor,
  label,
  subtitle,
}: {
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-[#F2C8B5] hover:bg-[#FBE6DD]/30 transition-colors"
    >
      <div
        className={`w-10 h-10 ${iconBg} rounded-md grid place-items-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
    </Link>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <IndianRupee className={`w-5 h-5 ${color}`} />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </h3>
      </div>
      <p className={`text-3xl font-bold ${color}`}>
        ₹{value.toLocaleString('en-IN')}
      </p>
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

export { Building };
