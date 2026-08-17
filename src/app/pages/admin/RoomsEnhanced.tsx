import { useEffect, useMemo, useState } from 'react';
import { Building, Users, Plus, Trash2, UserPlus, UserMinus, Search } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchLeafUnits,
  type UnitRowWithBuilding,
} from '../../data/units';
import {
  fetchBedsForUnit,
  createBed,
  deleteBed,
  assignBedToStudent,
  unassignBed,
  type BedRow,
} from '../../data/beds';
import {
  fetchStudents,
  type StudentRowWithBuilding,
} from '../../data/students';

export default function RoomsEnhanced() {
  const { current, isAllBuildings, loading: buildingLoading } = useBuilding();
  const [units, setUnits] = useState<UnitRowWithBuilding[]>([]);
  const [students, setStudents] = useState<StudentRowWithBuilding[]>([]);
  const [bedsByUnit, setBedsByUnit] = useState<Record<number, BedRow[]>>({});
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<{
    unit: UnitRowWithBuilding;
    bed: BedRow;
  } | null>(null);

  const [unitSearch, setUnitSearch] = useState('');
  const [vacancyFilter, setVacancyFilter] = useState<
    'all' | 'Available' | 'Partially Occupied' | 'Occupied'
  >('all');

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    Promise.all([fetchLeafUnits(buildingId), fetchStudents(buildingId)])
      .then(([u, s]) => {
        if (cancelled) return;
        setUnits(u);
        setStudents(s);
        setBedsByUnit({});
        setExpandedUnit(null);
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
    const [u, s] = await Promise.all([
      fetchLeafUnits(buildingId),
      fetchStudents(buildingId),
    ]);
    setUnits(u);
    setStudents(s);
    if (expandedUnit !== null) {
      try {
        const beds = await fetchBedsForUnit(expandedUnit);
        setBedsByUnit((prev) => ({ ...prev, [expandedUnit]: beds }));
      } catch {
        // ignore
      }
    }
  };

  const expandUnit = async (unitId: number) => {
    if (expandedUnit === unitId) {
      setExpandedUnit(null);
      return;
    }
    setExpandedUnit(unitId);
    if (!bedsByUnit[unitId]) {
      try {
        const beds = await fetchBedsForUnit(unitId);
        setBedsByUnit((prev) => ({ ...prev, [unitId]: beds }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleAddBed = async (unit: UnitRowWithBuilding) => {
    try {
      const beds = bedsByUnit[unit.id] ?? [];
      const label = `Bed ${beds.length + 1}`;
      await createBed(unit.id, label);
      const refreshed = await fetchBedsForUnit(unit.id);
      setBedsByUnit((prev) => ({ ...prev, [unit.id]: refreshed }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemoveBed = async (unit: UnitRowWithBuilding, bed: BedRow) => {
    if (bed.is_occupied || bed.student_id) {
      toast.error('This bed is assigned to a student. Unassign first.');
      return;
    }
    if (!confirm(`Remove ${bed.label}?`)) return;
    try {
      await deleteBed(bed.id);
      const refreshed = await fetchBedsForUnit(unit.id);
      setBedsByUnit((prev) => ({ ...prev, [unit.id]: refreshed }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAssign = async (studentId: number) => {
    if (!assigning) return;
    try {
      await assignBedToStudent(assigning.bed.id, studentId);
      const refreshed = await fetchBedsForUnit(assigning.unit.id);
      setBedsByUnit((prev) => ({ ...prev, [assigning.unit.id]: refreshed }));
      setAssigning(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUnassign = async (unit: UnitRowWithBuilding, bed: BedRow) => {
    if (!confirm('Unassign this student?')) return;
    try {
      await unassignBed(bed.id);
      const refreshed = await fetchBedsForUnit(unit.id);
      setBedsByUnit((prev) => ({ ...prev, [unit.id]: refreshed }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const getStudentName = (studentId: number | null) => {
    if (!studentId) return null;
    return students.find((s) => s.id === studentId)?.name ?? `#${studentId}`;
  };

  const availableStudents = useMemo(() => {
    if (!assigning) return [];
    // students in same building as the unit, with no bed
    return students.filter(
      (s) =>
        s.building_id === assigning.unit.building_id &&
        (s.bed_id === null || s.bed_id === undefined),
    );
  }, [students, assigning]);

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let partial = 0;
    let occupied = 0;
    units.forEach((u) => {
      total += 1;
      if (u.vacancy_status === 'Available') available += 1;
      else if (u.vacancy_status === 'Partially Occupied') partial += 1;
      else if (u.vacancy_status === 'Occupied') occupied += 1;
    });
    return { total, available, partial, occupied };
  }, [units]);

  const filteredUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    return units.filter((u) => {
      if (vacancyFilter !== 'all' && u.vacancy_status !== vacancyFilter) return false;
      if (!term) return true;
      return (
        u.label.toLowerCase().includes(term) ||
        u.type.toLowerCase().includes(term) ||
        (u.building_short_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [units, unitSearch, vacancyFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-700';
      case 'Partially Occupied':
        return 'bg-yellow-100 text-yellow-700';
      case 'Occupied':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (buildingLoading || loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load rooms: {error}
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
          <h1 className="text-3xl font-bold text-gray-800">Room Management</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total units" value={stats.total} />
        <StatCard label="Available" value={stats.available} tone="text-green-600" />
        <StatCard label="Partially occupied" value={stats.partial} tone="text-yellow-600" />
        <StatCard label="Fully occupied" value={stats.occupied} tone="text-red-600" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              placeholder="Search units (e.g. F-007, S-1A, Villa-2)…"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {([
              ['all', 'All'],
              ['Available', 'Free'],
              ['Partially Occupied', 'Partial'],
              ['Occupied', 'Full'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setVacancyFilter(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  vacancyFilter === value
                    ? 'bg-white text-[#B85138] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {units.length === 0
              ? 'No leaf units found for this building.'
              : 'No units match your search.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUnits.map((u) => {
              const beds = bedsByUnit[u.id] ?? [];
              const isOpen = expandedUnit === u.id;
              return (
                <div
                  key={u.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => expandUnit(u.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-[#B85138]" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800">{u.label}</p>
                          {isAllBuildings && (
                            <BuildingTag shortName={u.building_short_name} />
                          )}
                          <span className="text-xs uppercase tracking-wide text-gray-500">
                            {u.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {u.occupied_count}/{u.capacity} beds occupied
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        u.vacancy_status,
                      )}`}
                    >
                      {u.vacancy_status}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-800">
                          Beds ({beds.length})
                        </h3>
                        <button
                          onClick={() => handleAddBed(u)}
                          className="flex items-center gap-1 px-3 py-1 bg-[#B85138] text-white rounded hover:bg-[#92402C] text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add bed
                        </button>
                      </div>

                      {beds.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">
                          No beds yet — add one to start.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {beds.map((bed) => (
                            <div
                              key={bed.id}
                              className={`border rounded-lg p-3 ${
                                bed.is_occupied
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-green-300 bg-green-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium text-gray-800">{bed.label}</p>
                                  {bed.is_occupied && bed.student_id && (
                                    <p className="text-sm text-gray-600">
                                      {getStudentName(bed.student_id)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {bed.is_occupied && bed.student_id ? (
                                    <button
                                      onClick={() => handleUnassign(u, bed)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      title="Unassign"
                                    >
                                      <UserMinus className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setAssigning({ unit: u, bed })}
                                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                                      title="Assign student"
                                    >
                                      <UserPlus className="w-4 h-4" />
                                    </button>
                                  )}
                                  {!bed.is_occupied && (
                                    <button
                                      onClick={() => handleRemoveBed(u, bed)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      title="Remove bed"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  bed.is_occupied
                                    ? 'bg-red-200 text-red-700'
                                    : 'bg-green-200 text-green-700'
                                }`}
                              >
                                {bed.is_occupied ? 'Occupied' : 'Available'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {assigning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-[#B85138]" />
                <h2 className="text-xl font-bold text-gray-800">
                  Assign student to {assigning.bed.label}
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                {assigning.unit.label}
                {assigning.unit.building_short_name &&
                  ` — ${assigning.unit.building_short_name}`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {availableStudents.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">
                  No unassigned students in this building.
                </p>
              ) : (
                availableStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAssign(s.id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-[#FBE6DD] hover:border-[#F2C8B5]"
                  >
                    <p className="font-medium text-gray-800">{s.name}</p>
                    <p className="text-sm text-gray-600">
                      {s.college_id ?? '—'} · {s.branch ?? '—'}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
              <button
                onClick={() => setAssigning(null)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
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
