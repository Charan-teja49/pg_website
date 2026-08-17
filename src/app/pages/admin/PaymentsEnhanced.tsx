import { useEffect, useMemo, useState } from 'react';
import { IndianRupee, Filter, Plus, Search, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import PaymentReceipt from '../../components/PaymentReceipt';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchPaymentsForBuilding,
  recordPayment,
  type PaymentRow,
  type PaymentRowEnriched,
  type PaymentMode,
  type PaymentMethod,
} from '../../data/payments';
import {
  fetchStudents,
  getStudent,
  type StudentRowWithBuilding,
} from '../../data/students';
import {
  getFeeStructure,
  type FeeStructureRow,
} from '../../data/fees';

type ReceiptData = React.ComponentProps<typeof PaymentReceipt>['receipt'];

interface PaymentForm {
  student_id: number;
  amount: string;
  payment_mode: PaymentMode;
  payment_method: PaymentMethod | '';
  payment_date: string;
  received_by: string;
  transaction_notes: string;
}

const EMPTY_PAYMENT: PaymentForm = {
  student_id: 0,
  amount: '',
  payment_mode: 'Cash',
  payment_method: '',
  payment_date: new Date().toISOString().slice(0, 10),
  received_by: '',
  transaction_notes: '',
};

type FeePaymentStatus = 'Pending' | 'Partially Paid' | 'Fully Paid';

const feeStatusPill = (status: FeePaymentStatus | null): string => {
  switch (status) {
    case 'Fully Paid':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'Partially Paid':
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'Pending':
      return 'bg-red-100 text-red-700 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
};

export default function PaymentsEnhanced() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [payments, setPayments] = useState<PaymentRowEnriched[]>([]);
  const [students, setStudents] = useState<StudentRowWithBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT);
  const [selectedFee, setSelectedFee] = useState<FeeStructureRow | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [lastSavedFee, setLastSavedFee] = useState<{
    studentName: string;
    fee: FeeStructureRow;
  } | null>(null);

  const [modeFilter, setModeFilter] = useState<'all' | PaymentMode>('all');
  const [feeStatusFilter, setFeeStatusFilter] = useState<
    'all' | 'Pending' | 'Partially Paid' | 'Fully Paid'
  >('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  /**
   * Build a `ReceiptData` payload for the given payment row by fetching the
   * student record + current fee structure on demand. `p` may be either a
   * fully-enriched row (from the table) or a newly-created bare payment row
   * (after recordPayment). In the latter case we look up the building name
   * via the students list.
   */
  const openReceiptFor = async (
    p: PaymentRow | PaymentRowEnriched,
  ) => {
    setReceiptLoading(true);
    try {
      const [student, fee] = await Promise.all([
        getStudent(p.student_id),
        getFeeStructure(p.student_id),
      ]);
      if (!student) {
        toast.error('Could not load student for receipt');
        return;
      }
      // Try to find an enriched row for building/bed labels.
      const enriched = students.find((s) => s.id === p.student_id) ?? null;
      const buildingName =
        enriched?.building_short_name ??
        ('building_short_name' in p ? p.building_short_name : null) ??
        '—';
      setReceipt({
        payment_id: p.id,
        student_name: student.name,
        student_college_id: student.college_id,
        student_mobile: student.mobile,
        building_name: buildingName ?? '—',
        bed_label: enriched?.bed_label ?? null,
        unit_label: enriched?.unit_label ?? null,
        amount: Number(p.amount),
        payment_mode: p.payment_mode,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        received_by: p.received_by,
        transaction_notes: p.transaction_notes,
        total_payable: fee ? Number(fee.total_payable) : undefined,
        total_paid: fee ? Number(fee.total_paid) : undefined,
        balance_amount: fee ? Number(fee.balance_amount) : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setReceiptLoading(false);
    }
  };

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    Promise.all([
      fetchPaymentsForBuilding(buildingId),
      fetchStudents(buildingId),
    ])
      .then(([p, s]) => {
        if (cancelled) return;
        setPayments(p);
        setStudents(s);
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

  // When student in form changes, fetch their fee structure for context
  useEffect(() => {
    if (!paymentForm.student_id) {
      setSelectedFee(null);
      return;
    }
    let cancelled = false;
    getFeeStructure(paymentForm.student_id)
      .then((f) => {
        if (!cancelled) setSelectedFee(f);
      })
      .catch(() => {
        if (!cancelled) setSelectedFee(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentForm.student_id]);

  const reload = async () => {
    const buildingId = isAllBuildings ? null : current?.id ?? null;
    const p = await fetchPaymentsForBuilding(buildingId);
    setPayments(p);
  };

  const openCreate = () => {
    setPaymentForm(EMPTY_PAYMENT);
    setSelectedFee(null);
    setStudentSearch('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.student_id) {
      toast.error('Please select a student');
      return;
    }
    const amount = Number(paymentForm.amount);
    if (!(amount > 0)) {
      toast.error('Amount must be greater than 0');
      return;
    }
    if (paymentForm.payment_mode === 'Online' && !paymentForm.payment_method) {
      toast.error('Please select a payment method for online payment');
      return;
    }
    setSubmitting(true);
    try {
      const created = await recordPayment({
        student_id: paymentForm.student_id,
        amount,
        payment_mode: paymentForm.payment_mode,
        payment_method:
          paymentForm.payment_mode === 'Online'
            ? (paymentForm.payment_method as PaymentMethod)
            : null,
        payment_date: paymentForm.payment_date,
        received_by: paymentForm.received_by,
        transaction_notes: paymentForm.transaction_notes || null,
      });

      const fee = await getFeeStructure(paymentForm.student_id);
      const studentName =
        students.find((s) => s.id === paymentForm.student_id)?.name ?? 'Student';
      if (fee) {
        setLastSavedFee({ studentName, fee });
      }

      setShowForm(false);
      setPaymentForm(EMPTY_PAYMENT);
      setSelectedFee(null);
      setStudentSearch('');
      await reload();
      // Auto-show the printable receipt for the freshly recorded payment.
      void openReceiptFor(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    return payments.filter((p) => {
      if (modeFilter !== 'all' && p.payment_mode !== modeFilter) return false;
      if (feeStatusFilter !== 'all' && p.student_fee_status !== feeStatusFilter)
        return false;
      if (fromDate && p.payment_date < fromDate) return false;
      if (toDate && p.payment_date > toDate) return false;
      if (q && !(p.student_name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, modeFilter, feeStatusFilter, fromDate, toDate, paymentSearch]);

  const totals = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    return { total, count: filteredPayments.length };
  }, [filteredPayments]);

  const eligibleStudents = useMemo(() => {
    // Students for picker — already filtered by building
    return students.filter((s) => s.status === 'active');
  }, [students]);

  const matchingStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return eligibleStudents;
    return eligibleStudents.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.mobile ?? '').toLowerCase().includes(q) ||
        (s.college_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [eligibleStudents, studentSearch]);

  const pickedStudent = useMemo(
    () =>
      paymentForm.student_id
        ? eligibleStudents.find((s) => s.id === paymentForm.student_id) ?? null
        : null,
    [eligibleStudents, paymentForm.student_id],
  );

  const balance = selectedFee?.balance_amount ?? 0;
  const amountNum = Number(paymentForm.amount);
  const overpaying =
    !!pickedStudent && balance > 0 && amountNum > 0 && amountNum > balance;

  if (buildingLoading || (loading && payments.length === 0)) {
    return <div className="text-gray-600">Loading…</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-3xl font-bold text-gray-800">Payment Management</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Record Payment
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load payments: {error}
        </div>
      )}

      {lastSavedFee && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
          <div className="text-sm text-emerald-800">
            <span className="font-bold">{lastSavedFee.studentName}</span> — paid ₹
            {lastSavedFee.fee.total_paid.toLocaleString('en-IN')} of ₹
            {lastSavedFee.fee.total_payable.toLocaleString('en-IN')} (
            {lastSavedFee.fee.payment_status})
          </div>
          <button
            onClick={() => setLastSavedFee(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-emerald-700" />
            <p className="text-sm text-gray-600">Total collected (filtered)</p>
          </div>
          <p className="text-3xl font-bold text-emerald-700">
            ₹{totals.total.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-[#B85138]" />
            <p className="text-sm text-gray-600">Transactions</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{totals.count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Average</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            ₹
            {totals.count > 0
              ? Math.round(totals.total / totals.count).toLocaleString('en-IN')
              : 0}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Record Payment</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              id="record-payment-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Student <span className="text-red-600">*</span>
                  </label>
                  {pickedStudent && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentForm({ ...paymentForm, student_id: 0 });
                        setSelectedFee(null);
                      }}
                      className="text-xs text-[#B85138] hover:underline"
                    >
                      Unselect
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by name, mobile, or college ID…"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                  {matchingStudents.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      No students match.
                    </div>
                  ) : (
                    matchingStudents.map((s) => {
                      const isPicked = s.id === paymentForm.student_id;
                      const subParts = [
                        s.college_id,
                        s.branch,
                        isAllBuildings ? s.building_short_name : null,
                        s.bed_label,
                      ].filter(Boolean);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setPaymentForm({ ...paymentForm, student_id: s.id })
                          }
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                            isPicked
                              ? 'border-l-4 border-[#B85138] bg-[#FBE6DD]/40 ring-1 ring-[#B85138]'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold text-gray-800 truncate">
                              {s.name}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {s.fee_payment_status && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${feeStatusPill(
                                    s.fee_payment_status,
                                  )}`}
                                >
                                  {s.fee_payment_status}
                                </span>
                              )}
                              <span className="text-xs font-medium text-gray-700">
                                ₹
                                {(s.fee_balance ?? 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                          {subParts.length > 0 && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {subParts.join(' · ')}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedFee && (
                  <div className="mt-3 p-3 bg-[#FBE6DD] border border-[#F2C8B5] rounded">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total payable</p>
                        <p className="font-bold text-gray-800">
                          ₹{selectedFee.total_payable.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Paid</p>
                        <p className="font-bold text-emerald-700">
                          ₹{selectedFee.total_paid.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Balance</p>
                        <p className="font-bold text-red-700">
                          ₹{selectedFee.balance_amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mode <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_mode: e.target.value as PaymentMode,
                        payment_method:
                          e.target.value === 'Cash' ? '' : paymentForm.payment_method,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
                {paymentForm.payment_mode === 'Online' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Method <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          payment_method: e.target.value as PaymentMethod | '',
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                      required
                    >
                      <option value="">Select method</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="Google Pay">Google Pay</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Amount (₹) <span className="text-red-600">*</span>
                    </label>
                    {pickedStudent && balance > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentForm({
                            ...paymentForm,
                            amount: String(balance),
                          })
                        }
                        className="text-xs px-2 py-0.5 rounded bg-[#FBE6DD] text-[#92402C] border border-[#F2C8B5] hover:bg-[#F2C8B5] transition-colors font-medium"
                      >
                        Pay full balance · ₹{balance.toLocaleString('en-IN')}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    placeholder="Enter amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                    required
                    min="1"
                    step="1"
                  />
                  {overpaying && (
                    <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Amount exceeds balance (₹{balance.toLocaleString('en-IN')}).
                      Will result in overpayment.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Received by <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={paymentForm.received_by}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, received_by: e.target.value })
                  }
                  placeholder="Admin / staff name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={paymentForm.transaction_notes}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      transaction_notes: e.target.value,
                    })
                  }
                  placeholder="Add any notes about this payment…"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                  rows={3}
                />
              </div>

            </form>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-payment-form"
                disabled={submitting}
                className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {submitting ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
            Payer's current fee status
          </p>
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {([
              ['all', 'All'],
              ['Fully Paid', 'Paid'],
              ['Partially Paid', 'Partial'],
              ['Pending', 'Pending'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFeeStatusFilter(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  feeStatusFilter === value
                    ? 'bg-white text-[#B85138] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Mode
            </label>
            <select
              value={modeFilter}
              onChange={(e) =>
                setModeFilter(e.target.value as 'all' | PaymentMode)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            >
              <option value="all">All modes</option>
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="text-xl font-bold text-gray-800">Payment transactions</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search by student name…"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138] text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Student</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Mode</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Method</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Received by</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Notes</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                    {payments.length === 0
                      ? 'No payments recorded yet.'
                      : 'No payments match these filters.'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(p.payment_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.student_name}</span>
                        {isAllBuildings && (
                          <BuildingTag shortName={p.building_short_name} />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 font-medium">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          p.payment_mode === 'Online'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {p.payment_method ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{p.received_by}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                      {p.transaction_notes ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openReceiptFor(p)}
                        disabled={receiptLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#92402C] bg-[#FBE6DD] border border-[#F2C8B5] rounded hover:bg-[#F2C8B5] transition-colors disabled:opacity-50"
                        title="Print receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {receiptLoading && !receipt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-5 py-3 text-sm text-gray-700 shadow-lg">
            Loading receipt…
          </div>
        </div>
      )}

      {receipt && (
        <PaymentReceipt receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
