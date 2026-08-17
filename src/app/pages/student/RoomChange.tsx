import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import { getStudent, type StudentRow } from '../../data/students';
import {
  fetchStudentRoomChangeRequests,
  createRoomChangeRequest,
  type RoomChangeRequestRow,
  type RoomChangeStatus,
} from '../../data/roomRequests';
import {
  fetchLeafUnits,
  type UnitRowWithBuilding,
} from '../../data/units';
import {
  fetchBedsForBuilding,
  type BedRowEnriched,
} from '../../data/beds';

export default function StudentRoomChange() {
  const navigate = useNavigate();
  const [, setUser] = useState<AppUser | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [requests, setRequests] = useState<RoomChangeRequestRow[]>([]);
  const [leafUnits, setLeafUnits] = useState<UnitRowWithBuilding[]>([]);
  const [currentUnitId, setCurrentUnitId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [requestedUnitId, setRequestedUnitId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

        const [studentRow, requestRows, units, beds] = await Promise.all([
          getStudent(u.recordId),
          fetchStudentRoomChangeRequests(u.recordId),
          u.buildingId !== null
            ? fetchLeafUnits(u.buildingId)
            : Promise.resolve([] as UnitRowWithBuilding[]),
          u.buildingId !== null
            ? fetchBedsForBuilding(u.buildingId)
            : Promise.resolve([] as BedRowEnriched[]),
        ]);

        if (cancelled) return;
        setStudent(studentRow);
        setRequests(requestRows);
        setLeafUnits(units);

        const myBed =
          studentRow?.bed_id != null
            ? beds.find((b) => b.id === studentRow.bed_id) ?? null
            : null;
        setCurrentUnitId(myBed?.unit_id ?? null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const requested = requestedUnitId ? Number(requestedUnitId) : null;
      const created = await createRoomChangeRequest({
        student_id: student.id,
        current_bed_id: student.bed_id,
        requested_unit_id: requested,
        reason,
      });
      setRequests((prev) => [created, ...prev]);
      setShowForm(false);
      setReason('');
      setRequestedUnitId('');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: RoomChangeStatus) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Rejected':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load room change requests: {error}
      </div>
    );
  }

  const availableUnits = leafUnits.filter((u) => u.id !== currentUnitId);
  const unitLabelById = new Map(leafUnits.map((u) => [u.id, u.label]));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
          Room Change Requests
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Submit Room Change Request
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you want to change your room..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                rows={4}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested unit (optional)
              </label>
              <select
                value={requestedUnitId}
                onChange={(e) => setRequestedUnitId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
              >
                <option value="">No preference</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-[#FBE6DD] border border-[#FBE6DD] rounded-lg p-4">
              <p className="text-sm text-[#92402C]">
                Your request will be reviewed by the warden. You'll be notified
                once a decision is made.
              </p>
            </div>
            {submitError && (
              <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSubmitError(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No room change requests yet.</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0"
            >
              <div className="mb-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800">
                    Request #{request.id}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(request.status)}`}
                  >
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 break-words whitespace-pre-line">
                  {request.reason}
                </p>
                {request.requested_unit_id != null && (
                  <p className="text-xs text-gray-500 mt-2 break-words">
                    Preferred unit:{' '}
                    <span className="font-medium text-gray-700">
                      {unitLabelById.get(request.requested_unit_id) ??
                        `#${request.requested_unit_id}`}
                    </span>
                  </p>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                Requested on{' '}
                {new Date(request.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
