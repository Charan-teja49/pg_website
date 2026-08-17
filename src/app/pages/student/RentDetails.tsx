import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Home, BedDouble, IndianRupee } from 'lucide-react';
import { getCurrentUser, type AppUser } from '../../lib/auth';
import { getStudent, type StudentRow } from '../../data/students';
import {
  getFeeStructure,
  upsertFeeStructure,
  type FeeStructureRow,
  type PaymentPlan,
} from '../../data/fees';
import { fetchBuildings, type BuildingRow } from '../../data/buildings';
import {
  fetchBedsForBuilding,
  type BedRowEnriched,
} from '../../data/beds';
import { BUILDINGS, type BuildingCode } from '../../lib/buildings';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';

export default function StudentRentDetails() {
  const navigate = useNavigate();
  const [, setUser] = useState<AppUser | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [building, setBuilding] = useState<BuildingRow | null>(null);
  const [bed, setBed] = useState<BedRowEnriched | null>(null);
  const [fee, setFee] = useState<FeeStructureRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

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

        const [studentRow, feeRow, buildings, beds] = await Promise.all([
          getStudent(u.recordId),
          getFeeStructure(u.recordId),
          fetchBuildings(),
          u.buildingId !== null
            ? fetchBedsForBuilding(u.buildingId)
            : Promise.resolve([] as BedRowEnriched[]),
        ]);

        if (cancelled) return;
        setStudent(studentRow);
        setFee(feeRow);
        const b = buildings.find((x) => x.id === u.buildingId) ?? null;
        setBuilding(b);
        const myBed =
          studentRow?.bed_id != null
            ? beds.find((x) => x.id === studentRow.bed_id) ?? null
            : null;
        setBed(myBed);
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

  const buildingCode = building?.code as BuildingCode | undefined;
  const buildingConfig = buildingCode ? BUILDINGS[buildingCode] : null;
  const semesterAvailable = buildingConfig?.fee.semester_split ?? false;

  const switchPlan = async (newPlan: PaymentPlan) => {
    if (!student || !buildingConfig) return;
    if (fee?.payment_plan === newPlan) return;
    setSavingPlan(true);
    setPlanError(null);
    try {
      const updated = await upsertFeeStructure({
        student_id: student.id,
        payment_plan: newPlan,
        yearly_fee: buildingConfig.fee.yearly_fee,
        electricity_fee: buildingConfig.fee.electricity_fee,
        non_refundable_fee: buildingConfig.fee.non_refundable_fee,
      });
      setFee(updated);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPlan(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
        Failed to load rent details: {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Rent Details</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Room card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="w-16 h-16 bg-[#FBE6DD] rounded-lg flex items-center justify-center">
              <Home className="w-8 h-8 text-[#B85138]" />
            </div>
            <span className="px-3 py-1 bg-[#FBE6DD] text-[#B85138] rounded-full text-sm font-medium">
              {building?.short_name ?? '—'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Your Room</h2>
          {bed ? (
            <>
              <p className="text-gray-600 mb-4">
                Unit{' '}
                <span className="font-medium text-gray-800">
                  {bed.unit_label}
                </span>{' '}
                · Bed{' '}
                <span className="font-medium text-gray-800">{bed.label}</span>
              </p>
              <div className="border-t border-gray-200 pt-4 flex items-center gap-2 text-sm text-gray-700">
                <BedDouble className="w-4 h-4 text-[#B85138]" />
                <span>Bed assigned</span>
              </div>
            </>
          ) : (
            <p className="text-gray-500">
              You don't have a bed assigned yet.
            </p>
          )}
        </div>

        {/* Fee breakdown card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="w-16 h-16 bg-[#CCFBF1] rounded-lg flex items-center justify-center">
              <IndianRupee className="w-8 h-8 text-[#0F766E]" />
            </div>
            {fee && <PaymentStatusBadge status={fee.payment_status} size="md" />}
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Fee Breakdown</h2>
          {fee ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan</span>
                <span className="font-medium text-gray-800">
                  {fee.payment_plan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Yearly fee</span>
                <span className="font-medium text-gray-800">
                  ₹{fee.yearly_fee.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Electricity fee</span>
                <span className="font-medium text-gray-800">
                  ₹{fee.electricity_fee.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Non-refundable</span>
                <span className="font-medium text-gray-800">
                  ₹{fee.non_refundable_fee.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium text-gray-800">Total payable</span>
                <span className="font-bold text-gray-800">
                  ₹{fee.total_payable.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium text-[#0F766E]">
                  ₹{fee.total_paid.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Balance</span>
                <span className="font-medium text-red-700">
                  ₹{fee.balance_amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No fee structure has been set up yet.
            </p>
          )}
        </div>
      </div>

      {/* Plan toggle */}
      {buildingConfig && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-800">Payment Plan</h2>
            {savingPlan && (
              <span className="text-xs text-gray-500">Saving…</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Choose how you'd like to pay your fees. The numbers below are
            pulled from the building's fee config.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanOption
              label="Yearly"
              active={fee?.payment_plan === 'Yearly'}
              disabled={savingPlan}
              onClick={() => switchPlan('Yearly')}
              description={`Pay ₹${(
                buildingConfig.fee.yearly_fee +
                buildingConfig.fee.electricity_fee +
                buildingConfig.fee.non_refundable_fee
              ).toLocaleString('en-IN')} once for the year.`}
            />
            <PlanOption
              label="Semester"
              active={fee?.payment_plan === 'Semester'}
              disabled={savingPlan || !semesterAvailable}
              onClick={() => switchPlan('Semester')}
              description={
                semesterAvailable
                  ? `Split yearly fee into 2 instalments of ₹${(
                      buildingConfig.fee.yearly_fee / 2
                    ).toLocaleString('en-IN')}. Electricity + non-refundable due upfront.`
                  : 'Not available for this building.'
              }
            />
          </div>

          {planError && (
            <div className="mt-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
              {planError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanOption({
  label,
  active,
  disabled,
  onClick,
  description,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'border-[#0F766E] bg-[#CCFBF1]'
          : 'border-gray-200 bg-white hover:border-[#0F766E]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-800">{label}</span>
        {active && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#0F766E] text-white">
            Current
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}
