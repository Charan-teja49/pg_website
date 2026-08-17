import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { UserCircle, ArrowLeft } from 'lucide-react';
import { loginStudent } from '../lib/auth';
import PasswordInput from '../components/PasswordInput';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mobile.length !== 10) {
      setError('Mobile number must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      await loginStudent(mobile, password);
      navigate('/student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#CCFBF1]/50 via-[#FAF6EF] to-[#F4ECE4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#CCFBF1] rounded-full mb-4">
              <UserCircle className="w-8 h-8 text-[#0F766E]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Student Login</h1>
            <p className="text-gray-600 mt-2">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                placeholder="Enter 10-digit mobile number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                required
                maxLength={10}
                autoComplete="tel"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  to="/student/forgot-password"
                  className="text-sm text-[#0F766E] hover:text-[#115E59]"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F766E] text-white py-2.5 rounded-lg hover:bg-[#115E59] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
