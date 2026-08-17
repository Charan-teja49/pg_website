import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';

interface Props {
  student: {
    id: number;
    name: string;
    college_id: string | null;
    mobile: string;
    parent_mobile: string | null;
    course: string | null;
    branch: string | null;
    aadhaar_number: string | null;
  };
  building: {
    name: string;
    short_name: string;
    yearly_fee: number;
    electricity_fee: number;
    non_refundable_fee: number;
  };
  unit: { label: string; type: string } | null;
  bed: { label: string } | null;
  feeStructure: {
    total_payable: number;
    payment_plan: 'Yearly' | 'Semester';
  } | null;
  onClose: () => void;
}

/**
 * Formal allotment letter — printable. Mirrors the print-CSS pattern from
 * PaymentReceipt: everything outside `.pg-letter` is hidden while printing.
 */
export default function AllotmentLetter({
  student,
  building,
  unit,
  bed,
  feeStructure,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = new Date();
  const yearly = Number(building.yearly_fee || 0);
  const electricity = Number(building.electricity_fee || 0);
  const nonRefundable = Number(building.non_refundable_fee || 0);
  const totalPayable =
    feeStructure?.total_payable ?? yearly + electricity + nonRefundable;
  const plan = feeStructure?.payment_plan ?? 'Yearly';
  const planText =
    plan === 'Yearly' ? 'a single yearly' : 'two semester';

  const roomLine =
    unit && bed ? `${unit.label} · ${bed.label}` : 'a bed to be assigned shortly';

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .pg-letter, .pg-letter * { visibility: visible !important; }
          .pg-letter { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; padding: 28px !important; }
          .pg-letter-noprint { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pg-letter-noprint">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-xl">
            <p className="text-sm font-semibold text-gray-700">Allotment letter</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#B85138] text-white rounded-lg text-sm font-medium hover:bg-[#92402C]"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Letter body */}
          <div className="p-8 pg-letter flex-1 overflow-y-auto">
            {/* Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-[#B85138] pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-[#B85138] grid place-items-center text-white text-base font-bold tracking-tight">
                  PG
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">
                    {building.name}
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
                    Hostel Management
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  Date
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {today.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mt-2">
                  Ref
                </p>
                <p className="text-xs text-gray-700">
                  ALT/{building.short_name}/
                  {today.getFullYear()}/
                  {String(student.id).padStart(5, '0')}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#92402C] font-semibold">
                Hostel allotment letter
              </p>
            </div>

            {/* Student block */}
            <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <LetterField label="Student name" value={student.name} />
                <LetterField
                  label="College ID"
                  value={student.college_id ?? '—'}
                />
                <LetterField label="Mobile" value={student.mobile} />
                <LetterField
                  label="Parent mobile"
                  value={student.parent_mobile ?? '—'}
                />
                <LetterField
                  label="Course"
                  value={student.course ?? '—'}
                />
                <LetterField
                  label="Branch"
                  value={student.branch ?? '—'}
                />
                {student.aadhaar_number && (
                  <LetterField
                    label="Aadhaar (last 4)"
                    value={`XXXX-XXXX-${student.aadhaar_number.slice(-4)}`}
                  />
                )}
              </div>
            </div>

            {/* Body */}
            <div className="text-sm text-gray-800 leading-relaxed space-y-3 mb-6">
              <p>
                Dear <strong>{student.name}</strong>,
              </p>
              <p>
                We are pleased to confirm your allotment in{' '}
                <strong>{building.name}</strong> at <strong>{roomLine}</strong>.
                Your total payable hostel fee for the year is{' '}
                <strong>
                  ₹{totalPayable.toLocaleString('en-IN')}
                </strong>{' '}
                ({plan.toLowerCase()} plan), payable in {planText}{' '}
                instalment{plan === 'Semester' ? 's' : ''}. The non-refundable
                component is{' '}
                <strong>₹{nonRefundable.toLocaleString('en-IN')}</strong> and
                must be cleared on or before move-in.
              </p>
              <p>
                Please report to the warden's office with this letter, a copy of
                your Aadhaar, and a recent passport-size photograph on or before
                your move-in date. Kindly read the house rules summarised below
                — your continued stay is conditional on adherence to them.
              </p>
            </div>

            {/* Fee breakdown */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
                Fee breakdown
              </p>
              <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
                <tbody>
                  <FeeRow label="Yearly hostel fee" amount={yearly} />
                  <FeeRow label="Electricity" amount={electricity} />
                  <FeeRow
                    label="Non-refundable deposit"
                    amount={nonRefundable}
                  />
                  <tr className="bg-[#FBE6DD]">
                    <td className="px-3 py-2 text-sm font-bold text-[#92402C]">
                      Total payable
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-[#B85138] text-right">
                      ₹{totalPayable.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-gray-500 mt-1">
                Payment plan: <strong>{plan}</strong>
              </p>
            </div>

            {/* House rules */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
                House rules — summary
              </p>
              <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1.5">
                <li>
                  Hot water is available from 5:30 AM to 9:00 AM and 5:00 PM to
                  9:00 PM. Please plan accordingly.
                </li>
                <li>
                  Smoking, alcohol, and any form of intoxicants are strictly
                  prohibited anywhere on the premises.
                </li>
                <li>
                  The main gate closes at <strong>10:00 PM</strong>. Late entries
                  require prior written permission from the warden.
                </li>
                <li>
                  Guests are not allowed in the rooms after{' '}
                  <strong>9:00 PM</strong>; all visitors must be logged at the
                  reception.
                </li>
                <li>
                  Any complaint or maintenance issue should be raised via the
                  Student portal → Complaints; escalations go to the warden,
                  then to the building manager.
                </li>
              </ol>
            </div>

            {/* Signature */}
            <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
              <div>
                <div className="h-12 border-b border-gray-400" />
                <p className="text-xs text-gray-600 mt-1">
                  Warden — {building.short_name}
                </p>
              </div>
              <div>
                <div className="h-12 border-b border-gray-400" />
                <p className="text-xs text-gray-600 mt-1">
                  Date:{' '}
                  {today.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-6 text-[11px] text-gray-500 flex items-center justify-between">
              <span>{building.name} · Hostel Management</span>
              <span>This is a system-generated letter.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LetterField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function FeeRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="px-3 py-2 text-gray-700">{label}</td>
      <td className="px-3 py-2 text-gray-800 text-right font-medium">
        ₹{amount.toLocaleString('en-IN')}
      </td>
    </tr>
  );
}
