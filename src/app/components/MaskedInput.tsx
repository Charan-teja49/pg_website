import { useState, type ChangeEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MaskedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  label?: string;
  required?: boolean;
}

/**
 * Aadhaar-style partial mask: first 8 digits are hidden as X, last 4 are
 * always visible while the user types.
 *
 *   123456789012  →  XXXXXXXX9012
 *
 * Internally `value` is always the raw 12-digit string; only the rendered
 * `display` substitutes X for the first 8. The eye icon toggles to show
 * the full number.
 *
 * Implementation note: the visible input's value IS the masked string,
 * which means we need to figure out what the user typed by diffing the
 * new input against the previous display. We support the two common
 * actions — append at the end, delete from the end (or any contiguous
 * tail). Mid-string edits aren't preserved (rare in practice).
 */
export default function MaskedInput({
  value,
  onChange,
  placeholder = 'XXXXXXXX1234',
  maxLength = 12,
  className = '',
  label,
  required = false,
}: MaskedInputProps) {
  const [showAll, setShowAll] = useState(false);

  const renderDisplay = (digits: string) => {
    if (showAll) return digits;
    if (digits.length <= 8) return 'X'.repeat(digits.length);
    return 'X'.repeat(8) + digits.slice(8);
  };

  const display = renderDisplay(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;

    // When unmasked, just strip non-digits and replace.
    if (showAll) {
      const digits = next.replace(/\D/g, '').slice(0, maxLength);
      onChange(digits);
      return;
    }

    if (next.length > display.length) {
      // Append: extract the trailing digit(s) the user typed/pasted.
      const added = next.slice(display.length);
      const newDigits = added.replace(/\D/g, '');
      onChange((value + newDigits).slice(0, maxLength));
    } else if (next.length < display.length) {
      // Delete from the tail.
      const diff = display.length - next.length;
      onChange(value.slice(0, Math.max(0, value.length - diff)));
    } else {
      // Same length — probably a mid-string replace that we can't safely
      // round-trip. Fall back: if the new string contains digits, treat
      // it as a paste-replace of those digits.
      const onlyDigits = next.replace(/[^0-9]/g, '');
      if (onlyDigits.length > 0 && onlyDigits.length !== value.slice(8).length) {
        // user pasted/typed a fresh sequence
        onChange(onlyDigits.slice(0, maxLength));
      }
      // else: ignore — keep current value
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138] ${className}`}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
          aria-label={showAll ? 'Hide full number' : 'Reveal full number'}
          tabIndex={-1}
        >
          {showAll ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {value && value.length > 0 && value.length !== maxLength && (
        <p className="text-[10px] text-red-600 mt-1">
          Must be {maxLength} digits ({value.length}/{maxLength})
        </p>
      )}
    </div>
  );
}
