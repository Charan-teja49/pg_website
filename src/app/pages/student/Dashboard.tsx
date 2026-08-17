import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell,
  BedDouble,
  CreditCard,
  FileText,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import { getStudent, type StudentRow } from '../../data/students';
import { getFeeStructure, type FeeStructureRow } from '../../data/fees';
import { fetchStudentPayments, type PaymentRow } from '../../data/payments';
import {
  fetchAnnouncements,
  type AnnouncementRowEnriched,
} from '../../data/announcements';
import { fetchBuildings, type BuildingRow } from '../../data/buildings';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [building, setBuilding] = useState<BuildingRow | null>(null);
  const [fee, setFee] = useState<FeeStructureRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRowEnriched[]>(
    [],
  );
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

        const [studentRow, feeRow, paymentRows, announcementRows, buildings] =
          await Promise.all([
            getStudent(u.recordId),
            getFeeStructure(u.recordId),
            fetchStudentPayments(u.recordId),
            u.buildingId !== null
              ? fetchAnnouncements(u.buildingId)
              : Promise.resolve([] as AnnouncementRowEnriched[]),
            fetchBuildings(),
          ]);

        if (cancelled) return;
        setStudent(studentRow);
        setFee(feeRow);
        setPayments(paymentRows);
        setAnnouncements(announcementRows);
        setBuilding(
          buildings.find((b) => b.id === u.buildingId) ?? null,
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load dashboard: {error}
      </div>
    );
  }
  if (!user) return null;

  const recentPayments = payments.slice(0, 3);
  const topAnnouncements = announcements.slice(0, 5);
  const hasBed = student?.bed_id != null;

  return (
    <div>
      {/* Hero card */}
      <div className="rounded-lg border border-[#FBE6DD] bg-gradient-to-r from-[#FBE6DD] to-white p-6 mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
          {building?.short_name ?? 'Student Portal'}
        </p>
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome, {user.name ?? 'Student'}
        </h1>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
          <div>
            <p className="text-gray-500">Course</p>
            <p className="font-medium text-gray-800">
              {student?.course ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">College ID</p>
            <p className="font-medium text-gray-800">
              {student?.college_id ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Bed</p>
            <p className="font-medium text-gray-800 flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-[#B85138]" />
              {hasBed ? 'Bed assigned' : 'No bed yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Fee summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Payable</p>
          <p className="text-3xl font-bold text-gray-800">
            ₹{(fee?.total_payable ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Plan: {fee?.payment_plan ?? '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Paid</p>
          <p className="text-3xl font-bold text-[#0F766E]">
            ₹{(fee?.total_paid ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Balance ₹{(fee?.balance_amount ?? 0).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Status</p>
          <div className="mt-2">
            {fee ? (
              <PaymentStatusBadge status={fee.payment_status} size="lg" />
            ) : (
              <span className="text-sm text-gray-500">No fee structure yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent payments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0F766E]" />
              <h2 className="text-xl font-bold text-gray-800">Recent Payments</h2>
            </div>
            <Link
              to="/student/transactions"
              className="text-sm text-[#0F766E] hover:text-[#115E59]"
            >
              View all
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentPayments.map((p) => (
                <li
                  key={p.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN')} ·{' '}
                      {p.payment_mode}
                      {p.payment_method ? ` (${p.payment_method})` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    By {p.received_by}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#B85138]" />
            <h2 className="text-xl font-bold text-gray-800">Announcements</h2>
          </div>
          {topAnnouncements.length === 0 ? (
            <p className="text-sm text-gray-500">No announcements.</p>
          ) : (
            <ul className="space-y-4">
              {topAnnouncements.map((a) => (
                <li
                  key={a.id}
                  className="border-l-4 border-[#B85138] pl-4"
                >
                  <h3 className="font-medium text-gray-800">{a.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(a.created_at).toLocaleDateString('en-IN')}
                    {a.building_short_name
                      ? ` · ${a.building_short_name}`
                      : ' · Global'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          to="/student/complaints"
          label="Submit a complaint"
          icon={FileText}
        />
        <QuickAction
          to="/student/payments"
          label="Make a payment"
          icon={CreditCard}
        />
        <QuickAction
          to="/student/room-change"
          label="Request room change"
          icon={RefreshCw}
        />
      </div>
    </div>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 hover:border-[#B85138] hover:bg-[#FBE6DD]/30 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-[#FBE6DD] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#B85138]" />
      </div>
      <span className="font-medium text-gray-800">{label}</span>
    </Link>
  );
}
