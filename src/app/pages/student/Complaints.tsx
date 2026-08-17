import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, AlertCircle } from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import {
  fetchStudentComplaints,
  createComplaint,
  type ComplaintRow,
  type ComplaintCategory,
  type ComplaintStatus,
} from '../../data/complaints';

const CATEGORIES: ComplaintCategory[] = [
  'Electricity',
  'Plumbing',
  'AC',
  'WiFi',
  'Cleaning',
  'Others',
];

export default function StudentComplaints() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>('Electricity');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reloadComplaints = async (studentId: number) => {
    const rows = await fetchStudentComplaints(studentId);
    setComplaints(rows);
  };

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
        await reloadComplaints(u.recordId);
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
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createComplaint({
        student_id: user.recordId,
        building_id: user.buildingId,
        category,
        description,
      });
      setShowForm(false);
      setDescription('');
      setCategory('Electricity');
      await reloadComplaints(user.recordId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'Solved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      default:
        return 'bg-red-50 text-red-700 border border-red-200';
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load complaints: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-words">
          Complaints
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Raise Complaint
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">New Complaint</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ComplaintCategory)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your complaint..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
                rows={4}
                required
              />
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
                {submitting ? 'Submitting…' : 'Submit Complaint'}
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
        {complaints.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No complaints raised yet.</p>
          </div>
        ) : (
          complaints.map((complaint) => (
            <div
              key={complaint.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-800">
                      {complaint.category}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}
                    >
                      {complaint.status}
                    </span>
                  </div>
                  <p className="text-gray-600">{complaint.description}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Raised on{' '}
                {new Date(complaint.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
