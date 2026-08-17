import { useEffect, useState } from 'react';
import {
  Save,
  IndianRupee,
  Building,
  AlertCircle,
  Layers,
  Loader2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchBuildings,
  updateBuildingFees,
  type BuildingRow,
} from '../../data/buildings';
import { BUILDINGS, type BuildingCode } from '../../lib/buildings';
import {
  addFlats,
  addVillas,
  addFloorStack,
  getBuildingStructure,
  updatePlannedCapacity,
  type BuildingStructureCounts,
} from '../../data/units';

interface DraftFees {
  yearly_fee: string;
  electricity_fee: string;
  non_refundable_fee: string;
}

interface StructureDrafts {
  planned_capacity: string;
  // Chalapathi / flats-only
  flatsCount: string;
  bedsPerFlat: string;
  // Villas
  villasCount: string;
  bedsPerVilla: string;
  // Floor stack
  flatsPerFloor: string;
  roomsPerFlat: string;
  bedsPerRoom: string;
}

const draftFromRow = (b: BuildingRow): DraftFees => ({
  yearly_fee: String(b.yearly_fee),
  electricity_fee: String(b.electricity_fee),
  non_refundable_fee: String(b.non_refundable_fee),
});

const structureDraftFor = (b: BuildingRow): StructureDrafts => {
  const cfg = BUILDINGS[b.code as BuildingCode];
  const seed = cfg?.seed ?? {};
  const bedsDefault = cfg?.hierarchy.beds_per_unit ?? 1;
  return {
    planned_capacity: String(b.planned_capacity),
    flatsCount: '1',
    bedsPerFlat: String(seed.beds_per_unit ?? bedsDefault),
    villasCount: '1',
    bedsPerVilla: String(seed.beds_per_unit ?? bedsDefault),
    flatsPerFloor: String(seed.flats_per_floor ?? 2),
    roomsPerFlat: String(seed.rooms_per_flat ?? 2),
    bedsPerRoom: String(seed.beds_per_unit ?? bedsDefault),
  };
};

export default function AdminSettings() {
  const { refresh } = useBuilding();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftFees>>({});
  const [structDrafts, setStructDrafts] = useState<
    Record<number, StructureDrafts>
  >({});
  const [counts, setCounts] = useState<
    Record<number, BuildingStructureCounts | null>
  >({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState<number | null>(null);
  const [structOpen, setStructOpen] = useState<Record<number, boolean>>({});
  const [savingCapacityId, setSavingCapacityId] = useState<number | null>(null);
  const [addingStructId, setAddingStructId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadCounts = async (rows: BuildingRow[]) => {
    const next: Record<number, BuildingStructureCounts | null> = {};
    await Promise.all(
      rows.map(async (b) => {
        try {
          next[b.id] = await getBuildingStructure(b.id);
        } catch (e) {
          next[b.id] = null;
          // eslint-disable-next-line no-console
          console.error('getBuildingStructure failed', b.id, e);
        }
      }),
    );
    setCounts(next);
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchBuildings();
      setBuildings(rows);
      setDrafts(
        Object.fromEntries(rows.map((b) => [b.id, draftFromRow(b)])),
      );
      setStructDrafts((prev) =>
        Object.fromEntries(
          rows.map((b) => [b.id, prev[b.id] ?? structureDraftFor(b)]),
        ),
      );
      await reloadCounts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const refetchOne = async (b: BuildingRow) => {
    try {
      const c = await getBuildingStructure(b.id);
      setCounts((prev) => ({ ...prev, [b.id]: c }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('refetchOne failed', b.id, e);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (b: BuildingRow) => {
    const draft = drafts[b.id];
    if (!draft) return;
    const yearly = Number(draft.yearly_fee);
    const elec = Number(draft.electricity_fee);
    const nr = Number(draft.non_refundable_fee);
    if (!(yearly >= 0) || !(elec >= 0) || !(nr >= 0)) {
      toast.error('Fees must be non-negative numbers.');
      return;
    }
    setSavingId(b.id);
    try {
      await updateBuildingFees(b.id, {
        yearly_fee: yearly,
        electricity_fee: elec,
        non_refundable_fee: nr,
      });
      await reload();
      await refresh();
      setSavedFlash(b.id);
      setTimeout(
        () => setSavedFlash((c) => (c === b.id ? null : c)),
        2500,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveCapacity = async (b: BuildingRow) => {
    const sd = structDrafts[b.id];
    if (!sd) return;
    const n = Number(sd.planned_capacity);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Planned capacity must be a non-negative number.');
      return;
    }
    setSavingCapacityId(b.id);
    try {
      await updatePlannedCapacity(b.id, n);
      await reload();
      await refresh();
      toast.success(`Updated planned capacity for ${b.short_name || b.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCapacityId(null);
    }
  };

  const handleAddStructure = async (b: BuildingRow) => {
    const cfg = BUILDINGS[b.code as BuildingCode];
    const sd = structDrafts[b.id];
    if (!cfg || !sd) return;

    setAddingStructId(b.id);
    try {
      if (cfg.hierarchy.has_villas) {
        const count = Number(sd.villasCount);
        const beds = Number(sd.bedsPerVilla);
        if (!(count > 0) || !(beds > 0)) {
          toast.error('Villa count and beds per villa must be positive.');
          return;
        }
        const res = await addVillas(b.id, count, beds);
        toast.success(
          `Added ${res.villasCreated} villas + ${res.bedsCreated} beds.`,
        );
      } else if (cfg.hierarchy.has_floors) {
        const flatsPerFloor = Number(sd.flatsPerFloor);
        const roomsPerFlat = Number(sd.roomsPerFlat);
        const bedsPerRoom = Number(sd.bedsPerRoom);
        if (
          !(flatsPerFloor > 0) ||
          !(roomsPerFlat > 0) ||
          !(bedsPerRoom > 0)
        ) {
          toast.error('Floor / flat / room / bed counts must be positive.');
          return;
        }
        const prefix = b.code.startsWith('stanza') ? 'S' : 'D';
        const res = await addFloorStack(
          b.id,
          flatsPerFloor,
          roomsPerFlat,
          bedsPerRoom,
          prefix,
        );
        toast.success(
          `Added ${res.floorsCreated} floor + ${res.flatsCreated} flats + ${res.roomsCreated} rooms + ${res.bedsCreated} beds.`,
        );
      } else {
        // has_flats only (Chalapathi)
        const count = Number(sd.flatsCount);
        const beds = Number(sd.bedsPerFlat);
        if (!(count > 0) || !(beds > 0)) {
          toast.error('Flat count and beds per flat must be positive.');
          return;
        }
        const res = await addFlats(b.id, count, beds);
        toast.success(
          `Added ${res.flatsCreated} flats + ${res.bedsCreated} beds.`,
        );
      }
      await refetchOne(b);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingStructId(null);
    }
  };

  const isDirty = (b: BuildingRow) => {
    const d = drafts[b.id];
    if (!d) return false;
    return (
      Number(d.yearly_fee) !== b.yearly_fee ||
      Number(d.electricity_fee) !== b.electricity_fee ||
      Number(d.non_refundable_fee) !== b.non_refundable_fee
    );
  };

  const isCapacityDirty = (b: BuildingRow) => {
    const sd = structDrafts[b.id];
    if (!sd) return false;
    return Number(sd.planned_capacity) !== b.planned_capacity;
  };

  const updateStructDraft = (
    id: number,
    patch: Partial<StructureDrafts>,
  ) => {
    setStructDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load buildings: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
          System
        </p>
        <h1 className="text-3xl font-bold text-gray-800">Building settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edit per-building fee configuration and physical structure. Fee
          changes apply to <em>new</em> students. Structure additions create
          real units &amp; beds in the database — there is no undo.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          Fees here drive the &quot;Add Student&quot; form&apos;s auto-created
          fee_structure rows. To re-apply a new fee to existing students,
          you&apos;ll need a bulk-update tool (coming in Phase 5) or update each
          student&apos;s fee plan manually.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {buildings.map((b) => {
          const draft = drafts[b.id];
          const sd = structDrafts[b.id];
          if (!draft || !sd) return null;
          const dirty = isDirty(b);
          const capacityDirty = isCapacityDirty(b);
          const newTotal =
            Number(draft.yearly_fee) +
            Number(draft.electricity_fee) +
            Number(draft.non_refundable_fee);
          const cfg = BUILDINGS[b.code as BuildingCode];
          const c = counts[b.id] ?? null;
          const isOpen = structOpen[b.id] ?? true;
          const addingThis = addingStructId === b.id;
          const savingCapThis = savingCapacityId === b.id;

          return (
            <div
              key={b.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <header className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-[#FBE6DD] via-white to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#B85138]/10 grid place-items-center">
                    <Building className="w-4 h-4 text-[#B85138]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {b.name}
                    </h2>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                      {b.code} · planned capacity {b.planned_capacity}
                    </p>
                  </div>
                </div>
                {savedFlash === b.id && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                    Saved
                  </span>
                )}
              </header>

              <div className="p-5 space-y-4">
                <FeeField
                  label="Yearly fee"
                  value={draft.yearly_fee}
                  onChange={(v) =>
                    setDrafts((d) => ({
                      ...d,
                      [b.id]: { ...d[b.id], yearly_fee: v },
                    }))
                  }
                />
                <FeeField
                  label="Electricity fee"
                  value={draft.electricity_fee}
                  onChange={(v) =>
                    setDrafts((d) => ({
                      ...d,
                      [b.id]: { ...d[b.id], electricity_fee: v },
                    }))
                  }
                  hint="Set 0 for buildings without electricity charges"
                />
                <FeeField
                  label="Non-refundable fee"
                  value={draft.non_refundable_fee}
                  onChange={(v) =>
                    setDrafts((d) => ({
                      ...d,
                      [b.id]: { ...d[b.id], non_refundable_fee: v },
                    }))
                  }
                />

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                      New total payable
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      ₹{newTotal.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSave(b)}
                    disabled={!dirty || savingId === b.id}
                    className="flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                  >
                    {savingId === b.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingId === b.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* ───────────────── Structure section ───────────────── */}
              <div className="border-t border-gray-200 bg-[#FBE6DD]/30">
                <button
                  type="button"
                  onClick={() =>
                    setStructOpen((s) => ({ ...s, [b.id]: !isOpen }))
                  }
                  className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#FBE6DD]/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#92402C]" />
                    <span className="text-sm font-semibold text-[#92402C]">
                      Physical structure
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#92402C] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 space-y-5">
                    {/* Counts row */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <KpiTile label="Floors" value={c?.floors ?? '—'} />
                      <KpiTile label="Flats" value={c?.flats ?? '—'} />
                      <KpiTile label="Rooms" value={c?.rooms ?? '—'} />
                      <KpiTile label="Villas" value={c?.villas ?? '—'} />
                      <KpiTile label="Beds" value={c?.beds_total ?? '—'} />
                      <KpiTile
                        label="Occupied"
                        value={c?.beds_occupied ?? '—'}
                      />
                    </div>

                    {/* Planned capacity */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">
                          Planned capacity
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={sd.planned_capacity}
                          onChange={(e) =>
                            updateStructDraft(b.id, {
                              planned_capacity: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveCapacity(b)}
                        disabled={!capacityDirty || savingCapThis}
                        className="flex items-center gap-2 px-3 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                      >
                        {savingCapThis ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {savingCapThis ? 'Saving…' : 'Save capacity'}
                      </button>
                    </div>

                    {/* Branched form */}
                    {cfg?.hierarchy.has_villas ? (
                      <VillasForm
                        sd={sd}
                        adding={addingThis}
                        onChange={(p) => updateStructDraft(b.id, p)}
                        onSubmit={() => handleAddStructure(b)}
                      />
                    ) : cfg?.hierarchy.has_floors ? (
                      <FloorStackForm
                        sd={sd}
                        adding={addingThis}
                        onChange={(p) => updateStructDraft(b.id, p)}
                        onSubmit={() => handleAddStructure(b)}
                        emptyHint={
                          c && c.floors === 0
                            ? 'No floors yet — the first floor will be Floor-1.'
                            : null
                        }
                      />
                    ) : (
                      <FlatsForm
                        sd={sd}
                        adding={addingThis}
                        onChange={(p) => updateStructDraft(b.id, p)}
                        onSubmit={() => handleAddStructure(b)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeeField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      <div className="relative">
        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]"
        />
      </div>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[#B85138]/15 bg-white px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </p>
      <p className="text-base font-bold text-[#92402C] leading-tight">
        {value}
      </p>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 block mb-1.5">
        {label}
      </label>
      <input
        type="number"
        min={min}
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]"
      />
    </div>
  );
}

function AddButton({
  adding,
  onClick,
  label,
}: {
  adding: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={adding}
      className="flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
    >
      {adding ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {adding ? 'Working…' : label}
    </button>
  );
}

function FlatsForm({
  sd,
  adding,
  onChange,
  onSubmit,
}: {
  sd: StructureDrafts;
  adding: boolean;
  onChange: (p: Partial<StructureDrafts>) => void;
  onSubmit: () => void;
}) {
  const count = Number(sd.flatsCount) || 0;
  const beds = Number(sd.bedsPerFlat) || 0;
  return (
    <div className="rounded-lg border border-[#B85138]/15 bg-white p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#92402C]">
        Add flats
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="How many flats?"
          value={sd.flatsCount}
          onChange={(v) => onChange({ flatsCount: v })}
        />
        <NumField
          label="Beds per flat"
          value={sd.bedsPerFlat}
          onChange={(v) => onChange({ bedsPerFlat: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          Will create: <strong>{count}</strong> flats +{' '}
          <strong>{count * beds}</strong> beds.
        </p>
        <AddButton adding={adding} onClick={onSubmit} label="Add flats" />
      </div>
    </div>
  );
}

function VillasForm({
  sd,
  adding,
  onChange,
  onSubmit,
}: {
  sd: StructureDrafts;
  adding: boolean;
  onChange: (p: Partial<StructureDrafts>) => void;
  onSubmit: () => void;
}) {
  const count = Number(sd.villasCount) || 0;
  const beds = Number(sd.bedsPerVilla) || 0;
  return (
    <div className="rounded-lg border border-[#B85138]/15 bg-white p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#92402C]">
        Add villas
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="How many villas?"
          value={sd.villasCount}
          onChange={(v) => onChange({ villasCount: v })}
        />
        <NumField
          label="Beds per villa"
          value={sd.bedsPerVilla}
          onChange={(v) => onChange({ bedsPerVilla: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          Will create: <strong>{count}</strong> villas +{' '}
          <strong>{count * beds}</strong> beds.
        </p>
        <AddButton adding={adding} onClick={onSubmit} label="Add villas" />
      </div>
    </div>
  );
}

function FloorStackForm({
  sd,
  adding,
  onChange,
  onSubmit,
  emptyHint,
}: {
  sd: StructureDrafts;
  adding: boolean;
  onChange: (p: Partial<StructureDrafts>) => void;
  onSubmit: () => void;
  emptyHint: string | null;
}) {
  const f = Number(sd.flatsPerFloor) || 0;
  const r = Number(sd.roomsPerFlat) || 0;
  const bd = Number(sd.bedsPerRoom) || 0;
  return (
    <div className="rounded-lg border border-[#B85138]/15 bg-white p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#92402C]">
        Add a floor
      </p>
      {emptyHint && (
        <p className="text-[11px] text-gray-500 italic">{emptyHint}</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <NumField
          label="Flats / floor"
          value={sd.flatsPerFloor}
          onChange={(v) => onChange({ flatsPerFloor: v })}
        />
        <NumField
          label="Rooms / flat"
          value={sd.roomsPerFlat}
          onChange={(v) => onChange({ roomsPerFlat: v })}
        />
        <NumField
          label="Beds / room"
          value={sd.bedsPerRoom}
          onChange={(v) => onChange({ bedsPerRoom: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-500">
          Will create: 1 floor + <strong>{f}</strong> flats +{' '}
          <strong>{f * r}</strong> rooms + <strong>{f * r * bd}</strong> beds.
        </p>
        <AddButton adding={adding} onClick={onSubmit} label="Add floor" />
      </div>
    </div>
  );
}
