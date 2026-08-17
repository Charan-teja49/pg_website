import { useEffect } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface Props {
  receipt: {
    payment_id: number;
    student_name: string;
    student_college_id: string | null;
    student_mobile: string;
    building_name: string;
    bed_label: string | null;
    unit_label: string | null;
    amount: number;
    payment_mode: 'Cash' | 'Online';
    payment_method: string | null;
    payment_date: string;
    received_by: string;
    transaction_notes: string | null;
    total_payable?: number;
    total_paid?: number;
    balance_amount?: number;
  };
  onClose: () => void;
}

/**
 * Printable payment receipt. Uses CSS @media print to hide everything
 * except the receipt content when the user prints. The modal can also be
 * dismissed without printing.
 */
export default function PaymentReceipt({ receipt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = new Date(receipt.payment_date);
  const printedAt = new Date();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .pg-receipt, .pg-receipt * { visibility: visible !important; }
          .pg-receipt { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; padding: 24px !important; }
          .pg-receipt-noprint { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pg-receipt-noprint">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-xl flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700">Payment receipt</p>
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

          {/* Receipt body */}
          <div className="p-6 sm:p-8 pg-receipt flex-1 overflow-y-auto">
            <div className="flex items-start justify-between border-b-2 border-[#B85138] pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-md bg-[#B85138] grid place-items-center text-white text-sm font-bold tracking-tight">
                    PG
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-800 leading-tight">
                      {receipt.building_name}
                    </h1>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Hostel Management
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  Receipt no.
                </p>
                <p className="text-xl font-bold text-gray-800">
                  #{String(receipt.payment_id).padStart(6, '0')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {today.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
              <ReceiptField label="Student" value={receipt.student_name} />
              <ReceiptField
                label="College ID"
                value={receipt.student_college_id ?? '—'}
              />
              <ReceiptField label="Mobile" value={receipt.student_mobile} />
              <ReceiptField
                label="Room / Bed"
                value={
                  receipt.unit_label && receipt.bed_label
                    ? `${receipt.unit_label} · ${receipt.bed_label}`
                    : 'Unassigned'
                }
              />
            </div>

            <div className="bg-[#FBE6DD] border border-[#F2C8B5] rounded-lg p-5 mb-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#92402C] font-semibold">
                    Amount received
                  </p>
                  <p className="text-4xl font-bold text-[#B85138]">
                    ₹{receipt.amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Confirmed</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-6">
              <ReceiptField
                label="Mode"
                value={receipt.payment_mode}
                small
              />
              <ReceiptField
                label="Method"
                value={receipt.payment_method ?? '—'}
                small
              />
              <ReceiptField
                label="Received by"
                value={receipt.received_by}
                small
              />
            </div>

            {(receipt.total_payable !== undefined ||
              receipt.total_paid !== undefined ||
              receipt.balance_amount !== undefined) && (
              <div className="border-t border-gray-200 pt-4 mb-6">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Account summary
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {receipt.total_payable !== undefined && (
                    <ReceiptField
                      label="Total payable"
                      value={`₹${receipt.total_payable.toLocaleString('en-IN')}`}
                      small
                    />
                  )}
                  {receipt.total_paid !== undefined && (
                    <ReceiptField
                      label="Total paid (incl. this)"
                      value={`₹${receipt.total_paid.toLocaleString('en-IN')}`}
                      small
                    />
                  )}
                  {receipt.balance_amount !== undefined && (
                    <ReceiptField
                      label="Balance"
                      value={`₹${receipt.balance_amount.toLocaleString('en-IN')}`}
                      small
                    />
                  )}
                </div>
              </div>
            )}

            {receipt.transaction_notes && (
              <div className="border-t border-gray-200 pt-4 mb-6">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
                  Notes
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {receipt.transaction_notes}
                </p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Generated on{' '}
                {printedAt.toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span>This is a system-generated receipt.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ReceiptField({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-[10px] uppercase tracking-wide text-gray-500 font-semibold ${
          small ? '' : 'mb-1'
        }`}
      >
        {label}
      </p>
      <p
        className={`${
          small ? 'text-sm' : 'text-base'
        } font-medium text-gray-800`}
      >
        {value}
      </p>
    </div>
  );
}
