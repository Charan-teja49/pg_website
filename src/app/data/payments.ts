import { supabase, pgError } from '../lib/supabase';
import type { FeePaymentStatus } from './fees';

export type PaymentMode = 'Online' | 'Cash';
export type PaymentMethod =
  | 'PhonePe'
  | 'Google Pay'
  | 'Paytm'
  | 'Bank Transfer'
  | 'Other';

export interface PaymentRow {
  id: number;
  student_id: number;
  amount: number;
  payment_mode: PaymentMode;
  payment_method: PaymentMethod | null;
  payment_date: string;
  received_by: string;
  transaction_notes: string | null;
  created_at: string;
}

export interface PaymentRowEnriched extends PaymentRow {
  student_name: string;
  building_short_name: string | null;
  student_fee_status: FeePaymentStatus | null;
  student_balance: number | null;
}

export type PaymentInput = Omit<PaymentRow, 'id' | 'created_at'>;

/** Pass `null` for cross-building list. */
export async function fetchPaymentsForBuilding(
  buildingId: number | null,
): Promise<PaymentRowEnriched[]> {
  let q = supabase
    .from('payments')
    .select(
      '*, students!inner(building_id, name, buildings(short_name), fee_structures(payment_status, balance_amount))',
    )
    .order('payment_date', { ascending: false });
  if (buildingId !== null) q = q.eq('students.building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchPaymentsForBuilding');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((p) => {
    const fs = p.students?.fee_structures;
    const fee = Array.isArray(fs) ? fs[0] : fs;
    return {
      ...p,
      student_name: p.students?.name ?? '—',
      building_short_name: p.students?.buildings?.short_name ?? null,
      student_fee_status: (fee?.payment_status as FeePaymentStatus) ?? null,
      student_balance: fee ? Number(fee.balance_amount) : null,
    };
  });
}

export async function fetchStudentPayments(
  studentId: number,
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false });
  if (error) throw pgError(error, 'fetchStudentPayments');
  return (data ?? []) as PaymentRow[];
}

export async function recordPayment(input: PaymentInput): Promise<PaymentRow> {
  const { data: created, error } = await supabase
    .from('payments')
    .insert(input)
    .select()
    .single();
  if (error) throw pgError(error, 'recordPayment');

  const { data: fee } = await supabase
    .from('fee_structures')
    .select('id, total_paid, total_payable')
    .eq('student_id', input.student_id)
    .maybeSingle();

  if (fee) {
    const total_paid = Number(fee.total_paid) + Number(input.amount);
    const balance_amount = Number(fee.total_payable) - total_paid;
    let payment_status: FeePaymentStatus = 'Pending';
    if (balance_amount <= 0) payment_status = 'Fully Paid';
    else if (total_paid > 0) payment_status = 'Partially Paid';
    await supabase
      .from('fee_structures')
      .update({ total_paid, balance_amount, payment_status })
      .eq('id', fee.id);
  }

  return created as PaymentRow;
}
