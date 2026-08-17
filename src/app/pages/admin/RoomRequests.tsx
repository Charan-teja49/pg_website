import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchRoomChangeRequestsForBuilding,
  updateRoomChangeRequestStatus,
  type RoomChangeRequestRowEnriched,
  type RoomChangeStatus,
} from '../../data/roomRequests';

export default function AdminRoomRequests() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [requests, setRequests] = useState<RoomChangeRequestRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchRoomChangeRequestsForBuilding(buildingId)
      .then((rows) => {
        if (!cancelled) setRequests(rows);
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

  const reload = async () => {
    const buildingId = isAllBuildings ? null : current?.id ?? null;
    const rows = await fetchRoomChangeRequestsForBuilding(buildingId);
    setRequests(rows);
  };

  const handleStatusUpdate = async (id: number, status: RoomChangeStatus) => {
    try {
      await updateRoomChangeRequestStatus(id, status);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'Pending').length,
      approved: requests.filter((r) => r.status === 'Approved').length,
      rejected: requests.filter((r) => r.status === 'Rejected').length,
    }),
    [requests],
  );

  const getStatusColor = (status: RoomChangeStatus) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (buildingLoading || (loading && requests.length === 0)) {
    return <div className="text-gray-600">Loading…</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
            Room Change Requests
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load requests: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Stat label="Total" value={stats.total} />
        <Stat
          label="Pending"
          value={stats.pending}
          icon={<Clock className="w-4 h-4 text-yellow-600" />}
          tone="text-yellow-600"
        />
        <Stat
          label="Approved"
          value={stats.approved}
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          tone="text-green-600"
        />
        <Stat
          label="Rejected"
          value={stats.rejected}
          icon={<XCircle className="w-4 h-4 text-red-600" />}
          tone="text-red-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
          All requests
        </h2>
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No room change requests yet.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="border border-gray-200 rounded-lg p-4 min-w-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">
                        {r.student_name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(
                          r.status,
                        )}`}
                      >
                        {r.status}
                      </span>
                      {isAllBuildings && (
                        <BuildingTag shortName={r.building_short_name} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600 break-words">
                        <span className="font-medium">Current bed:</span>{' '}
                        {r.current_bed_id ? `#${r.current_bed_id}` : '—'}
                      </p>
                      <p className="text-sm text-gray-600 break-words">
                        <span className="font-medium">Requested unit:</span>{' '}
                        {r.requested_unit_id ? `#${r.requested_unit_id}` : '—'}
                      </p>
                      <p className="text-sm text-gray-600 break-words whitespace-pre-line">
                        <span className="font-medium">Reason:</span> {r.reason}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested on{' '}
                        {new Date(r.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                  {r.status === 'Pending' && (
                    <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                      <button
                        onClick={() => handleStatusUpdate(r.id, 'Approved')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(r.id, 'Rejected')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-medium whitespace-nowrap"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'text-gray-800',
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
