import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Building,
  X,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useBuilding } from '../../lib/BuildingContext';
import {
  fetchAdmins,
  setAdminActive,
  deleteAdmin,
  type AdminRowEnriched,
  type AdminRole,
} from '../../data/admins';

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  assigned_building_id: number | null;
  mobile: string;
}

const EMPTY_FORM: CreateForm = {
  name: '',
  email: '',
  password: '',
  role: 'building_staff',
  assigned_building_id: null,
  mobile: '',
};

export default function AdminStaff() {
  const navigate = useNavigate();
  const { buildings } = useBuilding();
  const [me, setMe] = useState<AppUser | null>(null);
  const [admins, setAdmins] = useState<AdminRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  // Password reset modal state
  const [resettingFor, setResettingFor] = useState<AdminRowEnriched | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);

  // Super-only gate
  useEffect(() => {
    let active = true;
    (async () => {
      const u = await getCurrentUser();
      if (!active) return;
      if (!u || u.role !== 'super') {
        navigate('/admin');
        return;
      }
      setMe(u);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAdmins();
      setAdmins(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) reload();
  }, [me]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (form.role === 'building_staff' && !form.assigned_building_id) {
      toast.error('Pick a building for building staff.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'provision-admin',
        {
          body: {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            assigned_building_id: form.assigned_building_id,
            mobile: form.mobile || null,
          },
        },
      );
      if (invokeErr) throw invokeErr;
      const res = data as { ok?: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error ?? 'Provisioning failed');
      toast.success(
        `${form.role === 'super' ? 'Super admin' : 'Building staff'} added: ${form.email}`,
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to create admin. Make sure the Edge Function "provision-admin" is deployed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (a: AdminRowEnriched) => {
    if (a.id === me?.recordId) {
      toast.error("You can't disable your own account.");
      return;
    }
    try {
      await setAdminActive(a.id, !a.is_active);
      toast.success(`${a.name ?? a.username} ${a.is_active ? 'disabled' : 'enabled'}.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingFor) return;
    if (newPwd.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setResetting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'reset-admin-password',
        { body: { admin_id: resettingFor.id, new_password: newPwd } },
      );
      if (invokeErr) throw invokeErr;
      const res = data as { ok?: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error ?? 'Reset failed');
      toast.success(
        `Password reset for ${resettingFor.name ?? resettingFor.username}.`,
      );
      setResettingFor(null);
      setNewPwd('');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to reset password. Make sure the "reset-admin-password" Edge Function is deployed.',
      );
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (a: AdminRowEnriched) => {
    if (a.id === me?.recordId) {
      toast.error("You can't delete your own account.");
      return;
    }
    if (!confirm(`Delete admin ${a.name ?? a.username}? This is irreversible.`)) {
      return;
    }
    try {
      await deleteAdmin(a.id);
      toast.success('Admin removed from the admins table.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (!me) return null;
  if (loading && admins.length === 0)
    return <div className="text-gray-600">Loading…</div>;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            Access control
          </p>
          <h1 className="text-3xl font-bold text-gray-800">Staff &amp; Access</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create building-scoped staff accounts and manage their access.
            Super admins see everything; building staff are locked to their
            assigned building.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] shadow-sm font-medium text-sm"
        >
          <Plus className="w-5 h-5" />
          Add staff
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-3 px-4 font-medium">Name</th>
              <th className="py-3 px-4 font-medium">Email / Login</th>
              <th className="py-3 px-4 font-medium">Role</th>
              <th className="py-3 px-4 font-medium">Building</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No admins yet.
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-gray-800 font-medium">
                    {a.name ?? '—'}
                    {a.id === me.recordId && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-700">{a.username}</td>
                  <td className="py-3 px-4">
                    {a.role === 'super' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#FBE6DD] text-[#B85138] border border-[#F2C8B5]">
                        <ShieldCheck className="w-3 h-3" />
                        Super
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                        <Building className="w-3 h-3" />
                        Staff
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {a.assigned_building_short_name ?? '— all —'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {a.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setResettingFor(a);
                          setNewPwd('');
                        }}
                        className="p-1.5 text-[#B85138] hover:bg-[#FBE6DD] rounded"
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(a)}
                        disabled={a.id === me.recordId}
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-30"
                        title={a.is_active ? 'Disable' : 'Enable'}
                      >
                        {a.is_active ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        disabled={a.id === me.recordId}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#B85138] font-semibold">
                  Access control
                </p>
                <h2 className="text-xl font-bold text-gray-800">
                  Add an admin
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="p-2 rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <Row label="Full name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT}
                  required
                />
              </Row>
              <Row label="Email (login)" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@example.com"
                  className={INPUT}
                  required
                  autoComplete="off"
                />
              </Row>
              <Row label="Initial password" required hint="8+ chars; staff must reset on first login">
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Pg@Welcome123"
                  className={INPUT}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Row>
              <Row label="Mobile" hint="optional">
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  placeholder="9876543210"
                  className={INPUT}
                  maxLength={10}
                />
              </Row>
              <Row label="Role" required>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as AdminRole,
                      // clear building if switching to super
                      assigned_building_id:
                        e.target.value === 'super'
                          ? null
                          : form.assigned_building_id,
                    })
                  }
                  className={INPUT}
                >
                  <option value="building_staff">Building staff</option>
                  <option value="super">Super admin (full access)</option>
                </select>
              </Row>
              {form.role === 'building_staff' && (
                <Row label="Assigned building" required>
                  <select
                    value={form.assigned_building_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        assigned_building_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={INPUT}
                    required
                  >
                    <option value="">Pick a building</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.short_name} — {b.name}
                      </option>
                    ))}
                  </select>
                </Row>
              )}

              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                The new admin can sign in immediately at <code>/admin/login</code> with the
                email + password above. The password you set here is final —
                they will <em>not</em> be prompted to change it (admins are
                managed by the super admin).
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {submitting ? 'Creating…' : 'Create admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resettingFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-white rounded-xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#B85138] font-semibold">
                  Reset password
                </p>
                <h2 className="text-lg font-bold text-gray-800">
                  {resettingFor.name ?? resettingFor.username}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {resettingFor.username} ·{' '}
                  {resettingFor.role === 'super'
                    ? 'Super admin'
                    : `Staff @ ${resettingFor.assigned_building_short_name ?? '—'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResettingFor(null);
                  setNewPwd('');
                }}
                className="p-2 rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <Row label="New password" required hint="8+ characters">
                <input
                  type="text"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Pg@Welcome123"
                  className={INPUT}
                  minLength={8}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
              </Row>
              <p className="text-xs text-gray-500 mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                The admin can sign in with this password immediately. They are
                not prompted to change it on next login. Avoid special
                characters like <code>!@#%</code> until form-escaping is
                hardened.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setResettingFor(null);
                  setNewPwd('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {resetting ? 'Resetting…' : 'Set new password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]';

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
