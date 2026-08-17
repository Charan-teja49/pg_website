import { supabase, pgError } from '../lib/supabase';

export type StudentStatus = 'active' | 'inactive';

export interface StudentRow {
  id: number;
  auth_user_id: string | null;
  mobile: string;
  name: string;
  building_id: number | null;
  bed_id: number | null;
  course: string | null;
  college_id: string | null;
  parent_mobile: string | null;
  branch: string | null;
  aadhaar_number: string | null;
  aadhaar_image_url: string | null;
  notes: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentRowWithBuilding extends StudentRow {
  building_short_name: string | null;
  bed_label: string | null;
  unit_label: string | null;
  unit_type: string | null;
  fee_payment_status: 'Pending' | 'Partially Paid' | 'Fully Paid' | null;
  fee_total_paid: number | null;
  fee_total_payable: number | null;
  fee_balance: number | null;
}

export type StudentInput = Omit<
  StudentRow,
  'id' | 'auth_user_id' | 'created_at' | 'updated_at'
>;

/** Pass `null` for cross-building list. */
export async function fetchStudents(
  buildingId: number | null,
): Promise<StudentRowWithBuilding[]> {
  // beds<->students have two FKs (students.bed_id->beds.id and
  // beds.student_id->students.id). Disambiguate the embed by FK name —
  // we want the forward path students.bed_id (= 'this student's bed').
  let q = supabase
    .from('students')
    .select(
      '*, buildings(short_name), beds!students_bed_id_fkey(label, units(label, type)), fee_structures(payment_status, total_paid, total_payable, balance_amount)',
    )
    .order('id', { ascending: false });
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchStudents');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((s) => {
    // fee_structures is returned as an array even with a unique FK; take [0]
    const fee = Array.isArray(s.fee_structures)
      ? s.fee_structures[0]
      : s.fee_structures;
    return {
      ...s,
      building_short_name: s.buildings?.short_name ?? null,
      bed_label: s.beds?.label ?? null,
      unit_label: s.beds?.units?.label ?? null,
      unit_type: s.beds?.units?.type ?? null,
      fee_payment_status: fee?.payment_status ?? null,
      fee_total_paid: fee ? Number(fee.total_paid) : null,
      fee_total_payable: fee ? Number(fee.total_payable) : null,
      fee_balance: fee ? Number(fee.balance_amount) : null,
    };
  });
}

export async function getStudent(id: number): Promise<StudentRow | null> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw pgError(error, 'getStudent');
  return (data as StudentRow) ?? null;
}

export async function createStudent(input: StudentInput): Promise<StudentRow> {
  const { data, error } = await supabase
    .from('students')
    .insert(input)
    .select()
    .single();
  if (error) throw pgError(error, 'createStudent');
  return data as StudentRow;
}

export async function updateStudent(id: number, patch: Partial<StudentRow>) {
  const { error } = await supabase.from('students').update(patch).eq('id', id);
  if (error) throw pgError(error, 'updateStudent');
}

export async function deleteStudent(id: number) {
  const { data: student } = await supabase
    .from('students')
    .select('bed_id')
    .eq('id', id)
    .maybeSingle();
  if (student?.bed_id) {
    await supabase
      .from('beds')
      .update({ is_occupied: false, student_id: null })
      .eq('id', student.bed_id);
  }
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw pgError(error, 'deleteStudent');
}

export async function uploadAadhaarImage(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('aadhaar').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw pgError(error, 'uploadAadhaarImage');
  const { data } = supabase.storage.from('aadhaar').getPublicUrl(path);
  return data.publicUrl;
}
