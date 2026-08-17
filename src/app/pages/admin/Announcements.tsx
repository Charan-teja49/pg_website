import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import BuildingTag from '../../components/BuildingTag';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementRow,
  type AnnouncementRowEnriched,
} from '../../data/announcements';

type Scope = 'global' | number;

interface FormState {
  title: string;
  message: string;
  scope: Scope;
}

export default function AdminAnnouncements() {
  const {
    current,
    isAllBuildings,
    buildings,
    loading: buildingLoading,
  } = useBuilding();

  const [announcements, setAnnouncements] = useState<AnnouncementRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    title: '',
    message: '',
    scope: 'global',
  });

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchAnnouncements(buildingId)
      .then((rows) => {
        if (!cancelled) setAnnouncements(rows);
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
    const rows = await fetchAnnouncements(buildingId);
    setAnnouncements(rows);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      scope: isAllBuildings ? 'global' : current?.id ?? 'global',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (a: AnnouncementRow) => {
    setEditing(a);
    setFormData({
      title: a.title,
      message: a.message,
      scope: a.building_id === null ? 'global' : a.building_id,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const building_id = formData.scope === 'global' ? null : Number(formData.scope);
      if (editing) {
        await updateAnnouncement(editing.id, {
          title: formData.title,
          message: formData.message,
          building_id,
        });
      } else {
        await createAnnouncement({
          building_id,
          title: formData.title,
          message: formData.message,
        });
      }
      setShowForm(false);
      resetForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (buildingLoading || (loading && announcements.length === 0)) {
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
            Announcements
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          New Announcement
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load announcements: {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {editing ? 'Edit Announcement' : 'Create Announcement'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scope <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.scope === 'global' ? 'global' : String(formData.scope)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scope:
                      e.target.value === 'global' ? 'global' : Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
              >
                <option value="global">Global (every building)</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.short_name} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter announcement title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder="Enter announcement message"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                rows={4}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : editing ? 'Update' : 'Create'} Announcement
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
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
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No announcements yet.</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                      {a.title}
                    </h3>
                    {a.building_id === null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 border border-gray-200">
                        Global
                      </span>
                    ) : (
                      <BuildingTag shortName={a.building_short_name} />
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 mb-3 break-words whitespace-pre-line">
                    {a.message}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Posted {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 text-[#B85138] hover:bg-[#FBE6DD] rounded"
                    title="Edit"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
