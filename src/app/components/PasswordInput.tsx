import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showStrength?: boolean;
  className?: string;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  label,
  required = false,
  showStrength = false,
  className = '',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = () => {
    if (!value) return { strength: 0, text: '', color: '' };

    let strength = 0;
    if (value.length >= 8) strength++;
    if (/[a-z]/.test(value)) strength++;
    if (/[A-Z]/.test(value)) strength++;
    if (/[0-9]/.test(value)) strength++;
    if (/[^a-zA-Z0-9]/.test(value)) strength++;

    if (strength <= 2) return { strength, text: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, text: 'Medium', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, text: 'Strong', color: 'bg-green-500' };
    return { strength, text: 'Very Strong', color: 'bg-green-600' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`h-1 flex-1 rounded ${
                  level <= passwordStrength.strength
                    ? passwordStrength.color
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className={`text-xs ${
            passwordStrength.strength <= 2 ? 'text-red-600' :
            passwordStrength.strength <= 3 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            Password strength: {passwordStrength.text}
          </p>
        </div>
      )}
      {showStrength && value && value.length < 8 && (
        <p className="text-xs text-gray-600 mt-1">
          Password must be at least 8 characters
        </p>
      )}
    </div>
  );
}
