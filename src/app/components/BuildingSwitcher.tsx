import { Building, Layers } from 'lucide-react';
import { useBuilding } from '../lib/BuildingContext';

export default function BuildingSwitcher() {
  const { buildings, currentId, current, isAllBuildings, setCurrent, loading, error } =
    useBuilding();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
        <Building className="w-4 h-4" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs"
        title={error}
      >
        <Building className="w-4 h-4" />
        DB error
      </div>
    );
  }

  if (buildings.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
        <Building className="w-4 h-4" />
        No buildings
      </div>
    );
  }

  // Locked to a single building (building_staff scope) — show static chip.
  if (buildings.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
        <Building className="w-4 h-4 text-gray-600" />
        <div className="flex-1">
          <p className="text-sm text-gray-800 font-medium leading-tight">
            {buildings[0].short_name}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight">
            Locked to your building
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-[#B85138]/40 transition-colors shadow-sm">
      {isAllBuildings ? (
        <Layers className="w-4 h-4 text-[#B85138]" />
      ) : (
        <Building className="w-4 h-4 text-gray-600" />
      )}
      <select
        value={currentId === null ? '__all__' : String(currentId)}
        onChange={(e) => {
          const v = e.target.value;
          setCurrent(v === '__all__' ? null : Number(v));
        }}
        className="bg-transparent text-sm text-gray-800 font-medium outline-none cursor-pointer flex-1"
        aria-label="Select building"
      >
        <option value="__all__">All buildings</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.short_name}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-gray-400 font-medium">
        {isAllBuildings ? buildings.length + ' bldgs' : current?.code}
      </span>
    </div>
  );
}
