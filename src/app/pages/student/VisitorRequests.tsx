import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  UserCheck,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Calendar,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import {
  createVisitorRequest,
  fetchStudentVisitorRequests,
  cancelVisitorRequest,
  VisitorsTableMissingError,
  type VisitorRow,
} from '../../data/visitors';

interface FormState {
  visitor_name: string;
  visitor_mobile: string;
  relation: string;
  purpose: string;
  requested_arrival: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  visitor_name: '',
  visitor_mobile: '',
  relation: 'Parent',
  purpose: '',
  requested_arrival: '',
  notes: '',
};

const RELATIONS = ['Parent', 'Sibling', 'Friend', 'Relative', 'Other'];

function statusBadge(s: string, hasEntry: boolean, hasExit: boolean) {
  if (s === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" /> Pending review
      </span>
    );
  }
  if (s === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }
  // Approved
  if (hasExit) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 border border-gray-200">
        <CheckCircle2 className="w-3 h-3" /> Visit complete
      </span>
    );
  }
  if (hasEntry) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Inside
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#CCFBF1] text-[#0F766E] border border-[#A7F3D0]">
      <CheckCircle2 className="w-3 h-3" /> Approved
    </span>
  );
}

export default function StudentVisitorRequests() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const reload = async (studentId: number) => {
    try {
      const data = await fetchStudentVisitorRequests(studentId);
      setRows(data);
      setTableMissing(false);
      setError(null);
    } catch (e) {
      if (e instanceof VisitorsTableMissingError) {
        setTableMissing(true);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await getCurrentUser();
        if (!active) return;
        if (!u || u.role !== 'student') {
          navigate('/student/login');
          return;
        }
        setUser(u);
        await reload(u.recordId);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.buildingId) {
      toast.error('No building assigned to your account.');
      return;
    }
    if (!form.visitor_name.trim()) {
      toast.error('Visitor name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await createVisitorRequest({
        building_id: user.buildingId,
        student_id: user.recordId,
        visitor_name: form.visitor_name.trim(),
        visitor_mobile: form.visitor_mobile || null,
        relation: form.relation || null,
        purpose: form.purpose || null,
        requested_arrival: form.requested_arrival
          ? new Date(form.requested_arrival).toISOString()
          : null,
        notes: form.notes || null,
      });
      toast.success('Visitor request submitted — the warden will review it.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await reload(user.recordId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (v: VisitorRow) => {
    if (!user) return;
    if (v.status !== 'Pending') {
      toast.error('Only pending requests can be cancelled.');
      return;
    }
    if (!confirm(`Cancel request for ${v.visitor_name}?`)) return;
    try {
      await cancelVisitorRequest(v.id);
      toast.success('Cancelled.');
      await reload(user.recordId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) return <div className="text-gray-600">Loading…</div>;

  if (tableMissing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        Visitor requests aren't set up yet. Ask the warden to run{' '}
        <code>0005_visitor_log.sql</code> and{' '}
        <code>0008_visitor_requests.sql</code>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#0F766E] font-semibold mb-1">
            {user?.name ?? 'Student'}
          </p>
          <h1 className="text-3xl font-bold text-gray-800">Visitor requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit a request before someone visits you — the warden approves or
            rejects it.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0F766E] text-white rounded-lg hover:bg-[#115E59] shadow-sm font-medium text-sm"
        >
          <Plus className="w-5 h-5" />
          New request
        </button>
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500 text-sm">
            No visitor requests yet. Click "New request" when someone plans to
            visit.
          </div>
        ) : (
          rows.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-[#CCFBF1] grid place-items-center flex-shrink-0">
                <UserCheck className="w-5 h-5 text-[#0F766E]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-base font-semibold text-gray-800">
                    {v.visitor_name}
                  </h3>
                  {statusBadge(v.status, !!v.entered_at, !!v.exited_at)}
                  {v.relation && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                      {v.relation}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  {v.visitor_mobile && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {v.visitor_mobile}
                    </div>
                  )}
                  {v.requested_arrival && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Expected{' '}
                      {new Date(v.requested_arrival).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                  {v.purpose && (
                    <p className="text-gray-700 mt-1">{v.purpose}</p>
                  )}
                  {v.status === 'Approved' && v.entered_at && (
                    <p className="text-emerald-700">
                      Entered{' '}
                      {new Date(v.entered_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {v.exited_at &&
                        ` · Exited ${new Date(v.exited_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`}
                    </p>
                  )}
                  {v.decision_note && (
                    <p className="text-red-700 italic">
                      Warden: {v.decision_note}
                    </p>
                  )}
                </div>
              </div>
              {v.status === 'Pending' && (
                <button
                  onClick={() => handleCancel(v)}
                  className="text-xs text-red-600 hover:underline flex-shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#CCFBF1]/40 via-white to-white rounded-t-xl flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F766E] font-semibold">
                  Request
                </p>
                <h2 className="text-xl font-bold text-gray-800">
                  Submit a visitor request
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="p-2 rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <FRow label="Visitor name" required>
                <input
                  type="text"
                  value={form.visitor_name}
                  onChange={(e) =>
                    setForm({ ...form, visitor_name: e.target.value })
                  }
                  className={INPUT}
                  required
                />
              </FRow>
              <FRow label="Visitor mobile" hint="optional">
                <input
                  type="tel"
                  value={form.visitor_mobile}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      visitor_mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  className={INPUT}
                  placeholder="98xxxxxxxx"
                />
              </FRow>
              <FRow label="Relation">
                <select
                  value={form.relation}
                  onChange={(e) => setForm({ ...form, relation: e.target.value })}
                  className={INPUT}
                >
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FRow>
              <FRow label="Expected arrival" hint="local time">
                <input
                  type="datetime-local"
                  value={form.requested_arrival}
                  onChange={(e) =>
                    setForm({ ...form, requested_arrival: e.target.value })
                  }
                  className={INPUT}
                />
              </FRow>
              <FRow label="Purpose">
                <input
                  type="text"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className={INPUT}
                  placeholder="Family visit, document drop-off, etc."
                />
              </FRow>
              <FRow label="Notes" hint="optional">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={INPUT}
                  rows={2}
                />
              </FRow>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#0F766E] text-white rounded-lg hover:bg-[#115E59] disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]';

function FRow({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
