import { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  /** Mandatory: shown when an admin has provisioned a welcome password and
   * the user must change it before doing anything else. The modal becomes
   * unclosable (no X button, no escape). */
  mandatory?: boolean;
  /** Called after password is successfully changed. */
  onDone: () => void;
  /** Only used when mandatory=false. */
  onCancel?: () => void;
}

export default function ChangePasswordModal({
  mandatory = false,
  onDone,
  onCancel,
}: Props) {
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    newPwd.length >= 8 && /[A-Za-z]/.test(newPwd) && /\d/.test(newPwd);
  const match = newPwd === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valid) {
      setError('Password must be at least 8 chars with letters + a number.');
      return;
    }
    if (!match) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Set new password
      const { error: pErr } = await supabase.auth.updateUser({
        password: newPwd,
      });
      if (pErr) throw pErr;
      // 2. Clear the must_change_password flag from user metadata
      const { error: mErr } = await supabase.auth.updateUser({
        data: { must_change_password: false },
      });
      if (mErr) throw mErr;
      onDone();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message ?? String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B85138] grid place-items-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#B85138] font-semibold">
                {mandatory ? 'First login' : 'Account'}
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                {mandatory ? 'Choose a new password' : 'Change password'}
              </h2>
            </div>
          </div>
          {mandatory && (
            <p className="text-sm text-gray-600 mt-3">
              You signed in with the welcome password. Please set a new
              password — you&apos;ll use this from now on.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoFocus
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              8+ chars, must include letters and at least one number.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Confirm password
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138]"
              required
            />
            {confirm.length > 0 && !match && (
              <p className="text-[10px] text-red-600 mt-1">
                Passwords don&apos;t match yet.
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {!mandatory && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !valid || !match}
              className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
            >
              {submitting ? 'Saving…' : mandatory ? 'Set password' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
