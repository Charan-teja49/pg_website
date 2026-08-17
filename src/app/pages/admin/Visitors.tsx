import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  LogOut as LogOutIcon,
  Trash2,
  Check,
  Ban,
  DoorOpen,
  Phone,
  Calendar,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding, type BuildingRow } from '../../lib/BuildingContext';
import {
  fetchVisitorsForBuilding,
  createWalkInVisitor,
  approveVisitor,
  rejectVisitor,
  markEntry,
  markExit,
  deleteVisitor,
  VisitorsTableMissingError,
  type VisitorRowEnriched,
  type VisitorStatus,
} from '../../data/visitors';
import { fetchStudents, type StudentRowWithBuilding } from '../../data/students';

type StatusFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'inside'
  | 'exited'
  | 'rejected';

interface WalkInForm {
  building_id: number | null;
  student_id: number | null;
  visitor_name: string;
  visitor_mobile: string;
  relation: string;
  purpose: string;
  id_proof_note: string;
  notes: string;
}

const EMPTY_WALKIN: WalkInForm = {
  building_id: null,
  student_id: null,
  visitor_name: '',
  visitor_mobile: '',
  relation: '',
  purpose: '',
  id_proof_note: '',
  notes: '',
};

const RELATIONS = ['Parent', 'Sibling', 'Friend', 'Relative', 'Other'];

function bucket(v: VisitorRowEnriched): StatusFilter {
  if (v.status === 'Pending') return 'pending';
  if (v.status === 'Rejected') return 'rejected';
  if (v.entered_at && !v.exited_at) return 'inside';
  if (v.entered_at && v.exited_at) return 'exited';
  return 'approved'; // Approved but not yet entered
}

export default function AdminVisitors() {
  const { current, isAllBuildings, buildings, loading: buildingLoading } =
    useBuilding();
  const [visitors, setVisitors] = useState<VisitorRowEnriched[]>([]);
  const [students, setStudents] = useState<StudentRowWithBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showWalkIn, setShowWalkIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<WalkInForm>(EMPTY_WALKIN);

  // Decision modal for reject (needs a reason)
  const [rejecting, setRejecting] = useState<VisitorRowEnriched | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    setTableMissing(false);
    try {
      const buildingId = isAllBuildings ? null : current?.id ?? null;
      const [v, s] = await Promise.all([
        fetchVisitorsForBuilding(buildingId),
        fetchStudents(buildingId).catch(() => []),
      ]);
      setVisitors(v);
      setStudents(s);
    } catch (e) {
      if (e instanceof VisitorsTableMissingError) {
        setTableMissing(true);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buildingLoading) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingLoading, isAllBuildings, current?.id]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return visitors.filter((v) => {
      if (statusFilter !== 'all' && bucket(v) !== statusFilter) return false;
      if (!term) return true;
      return (
        v.visitor_name.toLowerCase().includes(term) ||
        (v.visitor_mobile ?? '').includes(term) ||
        (v.student_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [visitors, searchTerm, statusFilter]);

  const counts = useMemo(() => {
    const c = {
      pending: 0,
      approved: 0,
      inside: 0,
      exited: 0,
      rejected: 0,
    };
    visitors.forEach((v) => {
      const b = bucket(v);
      if (b in c) (c as Record<StatusFilter, number>)[b]++;
    });
    return c;
  }, [visitors]);

  const handleWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.building_id) {
      toast.error('Pick a building.');
      return;
    }
    if (!form.visitor_name) {
      toast.error('Visitor name required.');
      return;
    }
    setSubmitting(true);
    try {
      await createWalkInVisitor({
        building_id: form.building_id,
        student_id: form.student_id,
        visitor_name: form.visitor_name,
        visitor_mobile: form.visitor_mobile || null,
        relation: form.relation || null,
        purpose: form.purpose || null,
        id_proof_note: form.id_proof_note || null,
        notes: form.notes || null,
      });
      toast.success('Walk-in logged.');
      setForm(EMPTY_WALKIN);
      setShowWalkIn(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (v: VisitorRowEnriched) => {
    try {
      await approveVisitor(v.id);
      toast.success(`Approved ${v.visitor_name}.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    if (!rejectNote.trim()) {
      toast.error('Please add a reason for the rejection.');
      return;
    }
    try {
      await rejectVisitor(rejecting.id, rejectNote.trim());
      toast.success(`Rejected ${rejecting.visitor_name}.`);
      setRejecting(null);
      setRejectNote('');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkEntry = async (v: VisitorRowEnriched) => {
    try {
      await markEntry(v.id);
      toast.success(`${v.visitor_name} marked as entered.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkExit = async (v: VisitorRowEnriched) => {
    try {
      await markExit(v.id);
      toast.success(`${v.visitor_name} marked as exited.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (v: VisitorRowEnriched) => {
    if (!confirm(`Delete the visitor record for ${v.visitor_name}?`)) return;
    try {
      await deleteVisitor(v.id);
      toast.success('Deleted.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const eligibleStudents = useMemo(() => {
    if (!form.building_id) return students;
    return students.filter((s) => s.building_id === form.building_id);
  }, [students, form.building_id]);

  if (buildingLoading || (loading && visitors.length === 0)) {
    return <div className="text-gray-600">Loading…</div>;
  }

  if (tableMissing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        Visitor log is not set up yet. Paste{' '}
        <code>supabase/migrations/0005_visitor_log.sql</code> and{' '}
        <code>supabase/migrations/0008_visitor_requests.sql</code> in
        Supabase SQL Editor to enable this page.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
            Visitors
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Student-submitted requests + walk-ins. Approve, reject, mark
            entry/exit.
          </p>
        </div>
        <button
          onClick={() => {
            const defaultBuildingId = isAllBuildings
              ? buildings[0]?.id ?? null
              : current?.id ?? null;
            setForm({ ...EMPTY_WALKIN, building_id: defaultBuildingId });
            setShowWalkIn(true);
          }}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] shadow-sm font-medium text-sm whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Log walk-in
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <CountTile label="Pending" value={counts.pending} tone="text-amber-700 bg-amber-50 border-amber-200" />
        <CountTile label="Approved" value={counts.approved} tone="text-[#0F766E] bg-[#CCFBF1]/40 border-[#A7F3D0]" />
        <CountTile label="Inside" value={counts.inside} tone="text-emerald-700 bg-emerald-50 border-emerald-200" />
        <CountTile label="Exited" value={counts.exited} tone="text-gray-700 bg-gray-50 border-gray-200" />
        <CountTile label="Rejected" value={counts.rejected} tone="text-red-700 bg-red-50 border-red-200" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by visitor or student name, mobile…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {([
              ['all', 'All'],
              ['pending', 'Pending'],
              ['approved', 'Approved'],
              ['inside', 'Inside'],
              ['exited', 'Exited'],
              ['rejected', 'Rejected'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  statusFilter === v
                    ? 'bg-white text-[#B85138] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500 text-sm">
            {visitors.length === 0
              ? 'No visitor records yet. Wait for student requests or log a walk-in.'
              : 'No records match your filters.'}
          </div>
        ) : (
          filtered.map((v) => (
            <VisitorCard
              key={v.id}
              v={v}
              showBuildingTag={isAllBuildings}
              onApprove={() => handleApprove(v)}
              onReject={() => {
                setRejecting(v);
                setRejectNote('');
              }}
              onMarkEntry={() => handleMarkEntry(v)}
              onMarkExit={() => handleMarkExit(v)}
              onDelete={() => handleDelete(v)}
            />
          ))
        )}
      </div>

      {/* Walk-in modal */}
      {showWalkIn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleWalkIn}
            className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#B85138] font-semibold">
                  Walk-in
                </p>
                <h2 className="text-xl font-bold text-gray-800">
                  Log a visitor who's here now
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkIn(false)}
                className="p-2 rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Building" required>
                  <select
                    value={form.building_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        building_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                        student_id: null,
                      })
                    }
                    className={INPUT}
                    required
                  >
                    <option value="">Pick a building</option>
                    {buildings.map((b: BuildingRow) => (
                      <option key={b.id} value={b.id}>
                        {b.short_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visiting student" hint="optional">
                  <select
                    value={form.student_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        student_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={INPUT}
                  >
                    <option value="">— none —</option>
                    {eligibleStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visitor name" required>
                  <input
                    type="text"
                    value={form.visitor_name}
                    onChange={(e) =>
                      setForm({ ...form, visitor_name: e.target.value })
                    }
                    className={INPUT}
                    required
                  />
                </Field>
                <Field label="Visitor mobile" hint="optional">
                  <input
                    type="tel"
                    value={form.visitor_mobile}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        visitor_mobile: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 10),
                      })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="Relation">
                  <select
                    value={form.relation}
                    onChange={(e) =>
                      setForm({ ...form, relation: e.target.value })
                    }
                    className={INPUT}
                  >
                    <option value="">—</option>
                    {RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="ID proof">
                  <input
                    type="text"
                    value={form.id_proof_note}
                    onChange={(e) =>
                      setForm({ ...form, id_proof_note: e.target.value })
                    }
                    placeholder="Aadhaar XXXX-1234, Voter ID, etc."
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="Purpose">
                <input
                  type="text"
                  value={form.purpose}
                  onChange={(e) =>
                    setForm({ ...form, purpose: e.target.value })
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="Notes" hint="optional">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={INPUT}
                  rows={2}
                />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWalkIn(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {submitting ? 'Logging…' : 'Log entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmitReject}
            className="bg-white rounded-xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                Reject visit
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Reason for rejecting <strong>{rejecting.visitor_name}</strong>'s
                visit to <strong>{rejecting.student_name ?? 'student'}</strong>?
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Late arrival expected · Identity unverified · Visiting hours over · …"
                className={INPUT}
                rows={3}
                required
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setRejectNote('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm shadow-sm"
              >
                Reject
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function VisitorCard({
  v,
  showBuildingTag,
  onApprove,
  onReject,
  onMarkEntry,
  onMarkExit,
  onDelete,
}: {
  v: VisitorRowEnriched;
  showBuildingTag: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMarkEntry: () => void;
  onMarkExit: () => void;
  onDelete: () => void;
}) {
  const b = bucket(v);
  const badge =
    b === 'pending'
      ? { c: 'bg-amber-50 text-amber-700 border-amber-200', l: 'Pending' }
      : b === 'inside'
        ? { c: 'bg-emerald-50 text-emerald-700 border-emerald-200', l: 'Inside' }
        : b === 'exited'
          ? { c: 'bg-gray-100 text-gray-700 border-gray-200', l: 'Exited' }
          : b === 'rejected'
            ? { c: 'bg-red-50 text-red-700 border-red-200', l: 'Rejected' }
            : { c: 'bg-[#CCFBF1] text-[#0F766E] border-[#A7F3D0]', l: 'Approved' };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#FBE6DD] grid place-items-center flex-shrink-0">
        <UserCheck className="w-5 h-5 text-[#B85138]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-base font-semibold text-gray-800">
            {v.visitor_name}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${badge.c}`}
          >
            {badge.l}
          </span>
          {showBuildingTag && (
            <BuildingTag shortName={v.building_short_name} />
          )}
          {v.relation && (
            <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
              {v.relation}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 space-y-0.5">
          {v.student_name && (
            <p>
              Visiting <strong>{v.student_name}</strong>
            </p>
          )}
          {v.visitor_mobile && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-gray-400" />
              {v.visitor_mobile}
            </div>
          )}
          {v.requested_arrival && !v.entered_at && (
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
          {v.entered_at && (
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
          {v.purpose && <p className="text-gray-700">{v.purpose}</p>}
          {v.id_proof_note && (
            <p className="text-gray-500 italic">ID: {v.id_proof_note}</p>
          )}
          {v.decision_note && v.status === 'Rejected' && (
            <p className="text-red-700 italic">
              Reason: {v.decision_note}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        {b === 'pending' && (
          <>
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              <Ban className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        )}
        {b === 'approved' && (
          <button
            onClick={onMarkEntry}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#0F766E] text-white rounded-lg text-xs font-medium hover:bg-[#115E59]"
          >
            <DoorOpen className="w-3.5 h-3.5" /> Mark entry
          </button>
        )}
        {b === 'inside' && (
          <button
            onClick={onMarkExit}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
          >
            <LogOutIcon className="w-3.5 h-3.5" /> Mark exit
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${tone}`}>
      <p className="text-[10px] uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({
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

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]';

// Suppress unused warning for VisitorStatus type imported for re-export safety
export type { VisitorStatus };
