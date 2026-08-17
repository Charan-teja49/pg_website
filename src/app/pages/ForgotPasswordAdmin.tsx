import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Shield, Lock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import PasswordInput from '../components/PasswordInput';

export default function ForgotPasswordAdmin() {
  const [step, setStep] = useState<'username' | 'otp' | 'reset' | 'success'>('username');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [registeredMobile, setRegisteredMobile] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.length !== 5 || !/^\d+$/.test(username)) {
      setError('Username must be exactly 5 digits');
      return;
    }

    setLoading(true);

    // Mock: Check if username exists and get registered mobile
    // In production, this would be an API call
    const mockMobile = '98765*****'; // Masked mobile
    setRegisteredMobile(mockMobile);

    // Mock OTP generation
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockOtp);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      toast.success(`OTP sent to ${mockMobile}: ${mockOtp} (This is for demo only)`);
    }, 1000);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp !== generatedOtp) {
      setError('Invalid OTP. Please try again.');
      return;
    }

    setStep('reset');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    // Simulate password reset
    setTimeout(() => {
      setLoading(false);
      setStep('success');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/admin/login"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </Link>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          {/* Username Step */}
          {step === 'username' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-full mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Admin Password Reset</h1>
                <p className="text-gray-600 mt-2">Enter your 5-digit username</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Username (5 digits)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="Enter 5-digit username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    required
                    maxLength={5}
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
                  className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            </>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Verify OTP</h1>
                <p className="text-gray-600 mt-2">
                  Enter the 6-digit OTP sent to {registeredMobile}
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest"
                    required
                    maxLength={6}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Verify OTP
                </button>

                <button
                  type="button"
                  onClick={() => handleSendOtp({ preventDefault: () => {} } as any)}
                  className="w-full text-gray-800 text-sm hover:underline"
                >
                  Resend OTP
                </button>
              </form>
            </>
          )}

          {/* Reset Password Step */}
          {step === 'reset' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-purple-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
                <p className="text-gray-600 mt-2">Create a new secure password</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-6">
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  label="New Password"
                  placeholder="Enter new password"
                  required
                  showStrength
                />

                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  label="Confirm Password"
                  placeholder="Re-enter new password"
                  required
                />

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 mb-2 font-medium">Password must contain:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• At least 8 characters</li>
                    <li>• Mix of uppercase and lowercase letters</li>
                    <li>• At least one number</li>
                    <li>• At least one special character</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h1>
                <p className="text-gray-600 mb-8">
                  Your admin password has been reset successfully. You can now login with your new password.
                </p>
                <Link
                  to="/admin/login"
                  className="inline-block w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-center"
                >
                  Go to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
