import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Building, Users, BedDouble } from 'lucide-react';
import { fetchBuildings, type BuildingRow } from '../data/buildings';
import { fetchLeafUnits, type UnitRowWithBuilding } from '../data/units';

interface BuildingBlock {
  building: BuildingRow;
  units: UnitRowWithBuilding[];
  totalBeds: number;
  occupiedBeds: number;
}

export default function PublicRoomView() {
  const [blocks, setBlocks] = useState<BuildingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [buildings, units] = await Promise.all([
          fetchBuildings(),
          fetchLeafUnits(null),
        ]);
        if (cancelled) return;
        const grouped: BuildingBlock[] = buildings.map((b) => {
          const list = units.filter((u) => u.building_id === b.id);
          const totalBeds = list.reduce((s, u) => s + u.capacity, 0);
          const occupiedBeds = list.reduce((s, u) => s + u.occupied_count, 0);
          return { building: b, units: list, totalBeds, occupiedBeds };
        });
        setBlocks(grouped);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF]">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF]">
        <div className="max-w-md text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
          Failed to load room data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#B85138] grid place-items-center text-white text-xs font-bold tracking-tight">
              PG
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">
                Hostel Management
              </p>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">
                Room Availability
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              to="/student/login"
              className="px-4 py-2 bg-[#0F766E] text-white rounded-lg hover:bg-[#115E59] transition-colors font-medium shadow-sm"
            >
              Student Login
            </Link>
            <Link
              to="/admin/login"
              className="px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors font-medium shadow-sm"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-1">Available rooms</h2>
          <p className="text-gray-600">
            Live occupancy across every building. Click a tile for details once
            you're signed in.
          </p>
        </div>

        <div className="space-y-8">
          {blocks.map(({ building, units, totalBeds, occupiedBeds }) => {
            const availableBeds = totalBeds - occupiedBeds;
            const occPct = totalBeds
              ? Math.round((occupiedBeds / totalBeds) * 100)
              : 0;
            return (
              <section
                key={building.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <header className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#FBE6DD] via-white to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#B85138]/10 grid place-items-center">
                        <Building className="w-5 h-5 text-[#B85138]" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {building.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          ₹{building.yearly_fee.toLocaleString('en-IN')}/year ·
                          electricity ₹
                          {building.electricity_fee.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <Stat label="Total beds" value={totalBeds.toString()} />
                      <Stat
                        label="Available"
                        value={availableBeds.toString()}
                        tone="text-emerald-700"
                      />
                      <Stat
                        label="Occupied"
                        value={`${occupiedBeds} (${occPct}%)`}
                        tone="text-[#B85138]"
                      />
                    </div>
                  </div>
                </header>

                {units.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500 text-sm">
                    Layout pending. Admin will configure rooms shortly.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
                    {units.map((u) => (
                      <UnitTile key={u.id} unit={u} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-10 bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-6">
            <LegendItem dot="bg-emerald-500" label="Available" />
            <LegendItem dot="bg-amber-500" label="Partially occupied" />
            <LegendItem dot="bg-[#B85138]" label="Occupied / full" />
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </p>
      <p className={`text-lg font-bold ${tone ?? 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function UnitTile({ unit }: { unit: UnitRowWithBuilding }) {
  const tone =
    unit.vacancy_status === 'Available'
      ? 'border-emerald-200 bg-emerald-50/50'
      : unit.vacancy_status === 'Partially Occupied'
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-[#F2C8B5] bg-[#FBE6DD]/40';
  const badge =
    unit.vacancy_status === 'Available'
      ? 'bg-emerald-100 text-emerald-700'
      : unit.vacancy_status === 'Partially Occupied'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-[#FBE6DD] text-[#92402C]';
  return (
    <div
      className={`border ${tone} rounded-lg p-4 transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold text-gray-800">{unit.label}</p>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
            {unit.type}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>
          {unit.vacancy_status === 'Partially Occupied'
            ? 'Partial'
            : unit.vacancy_status === 'Occupied'
              ? 'Full'
              : 'Open'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <BedDouble className="w-4 h-4" />
        <span className="text-sm">
          {unit.occupied_count}/{unit.capacity} occupied
        </span>
      </div>
    </div>
  );
}

function LegendItem({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${dot}`} />
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}

// Silence unused-import for `Users` (kept for future enhancement)
export { Users };
