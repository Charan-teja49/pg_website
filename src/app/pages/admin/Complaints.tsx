import { useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchComplaintsForBuilding,
  updateComplaintStatus,
  type ComplaintRowEnriched,
  type ComplaintStatus,
  type ComplaintCategory,
} from '../../data/complaints';

const CATEGORY_OPTIONS: ('all' | ComplaintCategory)[] = [
  'all',
  'Electricity',
  'Plumbing',
  'AC',
  'WiFi',
  'Cleaning',
  'Others',
];

export default function AdminComplaints() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [complaints, setComplaints] = useState<ComplaintRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ComplaintStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | 'all'>('all');

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchComplaintsForBuilding(buildingId)
      .then((c) => {
        if (!cancelled) setComplaints(c);
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
    const c = await fetchComplaintsForBuilding(buildingId);
    setComplaints(c);
  };

  const handleStatusUpdate = async (id: number, status: ComplaintStatus) => {
    try {
      await updateComplaintStatus(id, status);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const filtered = useMemo(
    () =>
      complaints.filter((c) => {
        if (filter !== 'all' && c.status !== filter) return false;
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        return true;
      }),
    [complaints, filter, categoryFilter],
  );

  const stats = useMemo(
    () => ({
      total: complaints.length,
      unsolved: complaints.filter((c) => c.status === 'Unsolved').length,
      inProgress: complaints.filter((c) => c.status === 'In Progress').length,
      solved: complaints.filter((c) => c.status === 'Solved').length,
    }),
    [complaints],
  );

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'Solved':
        return 'bg-green-100 text-green-700';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  if (buildingLoading || (loading && complaints.length === 0)) {
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
            Complaint Management
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load complaints: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Stat label="Total" value={stats.total} />
        <Stat label="Unsolved" value={stats.unsolved} tone="text-red-600" />
        <Stat label="In progress" value={stats.inProgress} tone="text-yellow-600" />
        <Stat label="Solved" value={stats.solved} tone="text-green-600" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            All complaints
          </h2>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Filter className="w-5 h-5 text-gray-600 flex-shrink-0" />
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as ComplaintStatus | 'all')
              }
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            >
              <option value="all">All status</option>
              <option value="Unsolved">Unsolved</option>
              <option value="In Progress">In Progress</option>
              <option value="Solved">Solved</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORY_OPTIONS.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-[#B85138] text-white border-[#B85138]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {complaints.length === 0
                ? 'No complaints yet.'
                : 'No complaints match the selected filter.'}
            </div>
          ) : (
            filtered.map((complaint) => (
              <div
                key={complaint.id}
                className="border border-gray-200 rounded-lg p-4 min-w-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">
                        {complaint.category}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(
                          complaint.status,
                        )}`}
                      >
                        {complaint.status}
                      </span>
                      {isAllBuildings && (
                        <BuildingTag shortName={complaint.building_short_name} />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 break-words whitespace-pre-line">
                      {complaint.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                      <span className="break-words">
                        Student: {complaint.student_name}
                      </span>
                      <span>
                        Date: {new Date(complaint.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="sm:flex-shrink-0">
                    <select
                      value={complaint.status}
                      onChange={(e) =>
                        handleStatusUpdate(
                          complaint.id,
                          e.target.value as ComplaintStatus,
                        )
                      }
                      className="w-full sm:w-auto px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138] text-sm"
                    >
                      <option value="Unsolved">Unsolved</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Solved">Solved</option>
                    </select>
                  </div>
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
  tone = 'text-gray-800',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
