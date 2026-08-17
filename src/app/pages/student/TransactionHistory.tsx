import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Receipt,
  Calendar,
  CreditCard,
  Filter,
  Download,
} from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import {
  fetchStudentPayments,
  type PaymentRow,
  type PaymentMode,
} from '../../data/payments';
import { getFeeStructure, type FeeStructureRow } from '../../data/fees';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';

type ModeFilter = 'all' | PaymentMode;

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [, setUser] = useState<AppUser | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [fee, setFee] = useState<FeeStructureRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

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

        const [paymentRows, feeRow] = await Promise.all([
          fetchStudentPayments(u.recordId),
          getFeeStructure(u.recordId),
        ]);
        if (cancelled) return;
        setPayments(paymentRows);
        setFee(feeRow);
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

  // Available months from payment data, sorted desc
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      const d = new Date(p.payment_date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(ym);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (modeFilter !== 'all' && p.payment_mode !== modeFilter) return false;
      if (monthFilter !== 'all') {
        const d = new Date(p.payment_date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (ym !== monthFilter) return false;
      }
      return true;
    });
  }, [payments, monthFilter, modeFilter]);

  const exportCsv = () => {
    const headers = [
      'id',
      'payment_date',
      'amount',
      'payment_mode',
      'payment_method',
      'received_by',
      'transaction_notes',
    ];
    const rows = filtered.map((p) =>
      [
        p.id,
        p.payment_date,
        p.amount,
        p.payment_mode,
        p.payment_method ?? '',
        p.received_by,
        (p.transaction_notes ?? '').replace(/"/g, '""'),
      ]
        .map((v) => `"${String(v)}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load transactions: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
            Transaction History
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Complete payment timeline and records.
          </p>
        </div>
        {payments.length > 0 && (
          <button
            onClick={exportCsv}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Summary */}
      {fee && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-gray-800">
              {payments.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Total Paid</p>
            <p className="text-3xl font-bold text-[#0F766E]">
              ₹{fee.total_paid.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-red-700">
              ₹{fee.balance_amount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <div className="mt-2">
              <PaymentStatusBadge status={fee.payment_status} size="md" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              <option value="all">All months</option>
              {monthOptions.map((ym) => {
                const [y, m] = ym.split('-');
                const label = new Date(
                  Number(y),
                  Number(m) - 1,
                  1,
                ).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                });
                return (
                  <option key={ym} value={ym}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Mode</label>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              <option value="all">All modes</option>
              <option value="Online">Online</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
          <span className="text-sm text-gray-500 ml-auto">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No transactions match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Txn ID</th>
                  <th className="py-3 px-4 font-medium">Amount</th>
                  <th className="py-3 px-4 font-medium">Mode</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium">Received by</th>
                  <th className="py-3 px-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(p.payment_date).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-mono text-xs">
                      TXN{p.id.toString().padStart(8, '0')}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#0F766E]">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          p.payment_mode === 'Online'
                            ? 'bg-[#CCFBF1] text-[#0F766E]'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {p.payment_method ? (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          {p.payment_method}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{p.received_by}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {p.transaction_notes ?? '—'}
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
