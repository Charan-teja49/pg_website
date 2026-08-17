import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchMaintenance,
  createMaintenance,
  deleteMaintenance,
  type MaintenanceRowEnriched,
} from '../../data/maintenance';

interface FormState {
  building_id: number | null;
  description: string;
  cost: string;
  performed_on: string;
  notes: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminMaintenance() {
  const {
    current,
    isAllBuildings,
    buildings,
    loading: buildingLoading,
  } = useBuilding();

  const [items, setItems] = useState<MaintenanceRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    building_id: null,
    description: '',
    cost: '',
    performed_on: todayISO(),
    notes: '',
  });

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchMaintenance(buildingId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
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
    const rows = await fetchMaintenance(buildingId);
    setItems(rows);
  };

  const openCreate = () => {
    setFormData({
      building_id: isAllBuildings
        ? buildings[0]?.id ?? null
        : current?.id ?? null,
      description: '',
      cost: '',
      performed_on: todayISO(),
      notes: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.building_id) {
      toast.error('Please pick a building');
      return;
    }
    const cost = Number(formData.cost);
    if (!(cost > 0)) {
      toast.error('Cost must be greater than 0');
      return;
    }
    setSubmitting(true);
    try {
      await createMaintenance({
        building_id: formData.building_id,
        description: formData.description,
        cost,
        performed_on: formData.performed_on,
        notes: formData.notes || null,
      });
      setShowForm(false);
      setFormData({
        building_id: formData.building_id,
        description: '',
        cost: '',
        performed_on: todayISO(),
        notes: '',
      });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this maintenance entry?')) return;
    try {
      await deleteMaintenance(id);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const totals = useMemo(() => {
    const total = items.reduce((s, m) => s + Number(m.cost ?? 0), 0);
    const now = new Date();
    const thisMonth = items
      .filter((m) => {
        const d = new Date(m.performed_on);
        return (
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, m) => s + Number(m.cost ?? 0), 0);
    return { total, thisMonth, count: items.length };
  }, [items]);

  if (buildingLoading || (loading && items.length === 0)) {
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
            Maintenance Expenses
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load maintenance: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-5 h-5 text-[#B85138]" />
            <p className="text-sm text-gray-600">Total records</p>
          </div>
          <p className="text-3xl font-bold text-[#B85138]">{totals.count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">This month</p>
          <p className="text-3xl font-bold text-orange-600">
            ₹{totals.thisMonth.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Total spend</p>
          <p className="text-3xl font-bold text-red-600">
            ₹{totals.total.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Add maintenance expense</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Building <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.building_id ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    building_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                required
              >
                <option value="">Select a building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.short_name} — {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter maintenance description"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost (₹) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="Enter cost"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                required
                min="1"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Performed on
              </label>
              <input
                type="date"
                value={formData.performed_on}
                onChange={(e) =>
                  setFormData({ ...formData, performed_on: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes…"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                rows={2}
              />
            </div>
            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Add Expense'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Expense history</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Cost</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Notes</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                    No maintenance records yet.
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(m.performed_on).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span>{m.description}</span>
                        {isAllBuildings && (
                          <BuildingTag shortName={m.building_short_name} />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">
                      ₹{Number(m.cost).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                      {m.notes ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
