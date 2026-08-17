import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  IndianRupee,
  Receipt,
  Calendar,
  Phone,
  CreditCard,
  Info,
} from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import { getFeeStructure, type FeeStructureRow } from '../../data/fees';
import {
  fetchStudentPayments,
  type PaymentRow,
} from '../../data/payments';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';

/**
 * STUDENT view of payments. Read-only — students do NOT record their own
 * payments; the admin/warden does that on their behalf. Students see:
 *   • Their current fee status (payable / paid / balance / plan)
 *   • A full history of past payments
 *   • A "how to pay" info card with warden contact + (future) online button
 */
export default function StudentPayments() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [fee, setFee] = useState<FeeStructureRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
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
        const [feeRow, paymentRows] = await Promise.all([
          getFeeStructure(u.recordId),
          fetchStudentPayments(u.recordId),
        ]);
        if (cancelled) return;
        setFee(feeRow);
        setPayments(paymentRows);
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

  if (loading && !user) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load payments: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#0F766E] font-semibold mb-1">
          {user?.name ?? 'Student'}
        </p>
        <h1 className="text-3xl font-bold text-gray-800">Fees & payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          A read-only view of your hostel fees. To make a payment, see the
          options below.
        </p>
      </div>

      {/* Fee summary */}
      {fee ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-[#CCFBF1]/40 via-white to-white border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#0F766E] font-semibold">
                Plan
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                {fee.payment_plan}
              </h2>
            </div>
            <PaymentStatusBadge status={fee.payment_status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
            <FeeStat
              label="Total payable"
              value={fee.total_payable}
              tone="text-gray-800"
            />
            <FeeStat
              label="Paid so far"
              value={fee.total_paid}
              tone="text-emerald-700"
            />
            <FeeStat
              label="Balance due"
              value={fee.balance_amount}
              tone={fee.balance_amount > 0 ? 'text-red-700' : 'text-emerald-700'}
            />
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          No fee plan set up yet for your account. Please contact the warden.
        </div>
      )}

      {/* How to pay */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#B85138]" />
          <h3 className="text-sm font-semibold text-gray-800">How to pay</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-emerald-700" />
              <p className="text-sm font-semibold text-gray-800">
                Cash / direct transfer
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Hand cash to the warden, or transfer to the building's account.
              The warden will record the payment against your account — it
              will then show up in your payment history below.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-700">
                Pay online
              </p>
              <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold ml-auto">
                coming soon
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Razorpay / UPI integration is on the way. For now please use the
              cash / transfer flow above.
            </p>
            <button
              disabled
              className="mt-3 w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
            >
              Pay online
            </button>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">
              Payment history
            </h3>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
            {payments.length} {payments.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {payments.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-500 text-center">
            No payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-3 px-6 font-medium">Date</th>
                  <th className="py-3 px-6 font-medium">Amount</th>
                  <th className="py-3 px-6 font-medium">Mode</th>
                  <th className="py-3 px-6 font-medium">Method</th>
                  <th className="py-3 px-6 font-medium">Received by</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 px-6 text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(p.payment_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-6 font-medium text-gray-800">
                      <div className="inline-flex items-center gap-0.5">
                        <IndianRupee className="w-3.5 h-3.5 text-gray-500" />
                        {Number(p.amount).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.payment_mode === 'Online'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-gray-700">
                      {p.payment_method ?? '—'}
                    </td>
                    <td className="py-3 px-6 text-gray-700">
                      {p.received_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FeeStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="px-6 py-5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${tone}`}>
        ₹{Number(value).toLocaleString('en-IN')}
      </p>
    </div>
  );
}
