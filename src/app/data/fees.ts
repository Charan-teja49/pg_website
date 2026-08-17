import { supabase, pgError } from '../lib/supabase';

export type PaymentPlan = 'Yearly' | 'Semester';
export type FeePaymentStatus = 'Pending' | 'Partially Paid' | 'Fully Paid';

export interface FeeStructureRow {
  id: number;
  student_id: number;
  payment_plan: PaymentPlan;
  yearly_fee: number;
  electricity_fee: number;
  non_refundable_fee: number;
  total_payable: number;
  total_paid: number;
  balance_amount: number;
  payment_status: FeePaymentStatus;
}

export interface FeeStructureInput {
  student_id: number;
  payment_plan: PaymentPlan;
  yearly_fee: number;
  electricity_fee: number;
  non_refundable_fee: number;
}

export async function getFeeStructure(
  studentId: number,
): Promise<FeeStructureRow | null> {
  const { data, error } = await supabase
    .from('fee_structures')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw pgError(error, 'getFeeStructure');
  return (data as FeeStructureRow) ?? null;
}

export async function createFeeStructure(
  input: FeeStructureInput,
): Promise<FeeStructureRow> {
  const total_payable =
    Number(input.yearly_fee) +
    Number(input.electricity_fee) +
    Number(input.non_refundable_fee);
  const { data, error } = await supabase
    .from('fee_structures')
    .insert({
      ...input,
      total_payable,
      total_paid: 0,
      balance_amount: total_payable,
      payment_status: 'Pending',
    })
    .select()
    .single();
  if (error) throw pgError(error, 'createFeeStructure');
  return data as FeeStructureRow;
}

export async function upsertFeeStructure(
  input: FeeStructureInput,
): Promise<FeeStructureRow> {
  const existing = await getFeeStructure(input.student_id);
  if (!existing) return createFeeStructure(input);
  const total_payable =
    Number(input.yearly_fee) +
    Number(input.electricity_fee) +
    Number(input.non_refundable_fee);
  const balance_amount = total_payable - Number(existing.total_paid);
  const payment_status: FeePaymentStatus =
    balance_amount <= 0
      ? 'Fully Paid'
      : Number(existing.total_paid) > 0
        ? 'Partially Paid'
        : 'Pending';
  const { data, error } = await supabase
    .from('fee_structures')
    .update({ ...input, total_payable, balance_amount, payment_status })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw pgError(error, 'upsertFeeStructure');
  return data as FeeStructureRow;
}
