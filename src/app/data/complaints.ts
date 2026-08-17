import { supabase, pgError } from '../lib/supabase';

export type ComplaintCategory =
  | 'Electricity'
  | 'Plumbing'
  | 'AC'
  | 'WiFi'
  | 'Cleaning'
  | 'Others';
export type ComplaintStatus = 'Unsolved' | 'In Progress' | 'Solved';

export interface ComplaintRow {
  id: number;
  student_id: number;
  building_id: number | null;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
}

export interface ComplaintRowEnriched extends ComplaintRow {
  student_name: string;
  building_short_name: string | null;
}

/** Pass `null` for cross-building list. */
export async function fetchComplaintsForBuilding(
  buildingId: number | null,
): Promise<ComplaintRowEnriched[]> {
  let q = supabase
    .from('complaints')
    .select('*, students!inner(name, building_id, buildings(short_name))')
    .order('created_at', { ascending: false });
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchComplaintsForBuilding');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((c) => ({
    ...c,
    student_name: c.students?.name ?? '—',
    building_short_name: c.students?.buildings?.short_name ?? null,
  }));
}

export async function fetchStudentComplaints(
  studentId: number,
): Promise<ComplaintRow[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw pgError(error, 'fetchStudentComplaints');
  return (data ?? []) as ComplaintRow[];
}

export async function createComplaint(input: {
  student_id: number;
  building_id: number | null;
  category: ComplaintCategory;
  description: string;
}): Promise<ComplaintRow> {
  const { data, error } = await supabase
    .from('complaints')
    .insert({ ...input, status: 'Unsolved' })
    .select()
    .single();
  if (error) throw pgError(error, 'createComplaint');
  return data as ComplaintRow;
}

export async function updateComplaintStatus(
  id: number,
  status: ComplaintStatus,
) {
  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', id);
  if (error) throw pgError(error, 'updateComplaintStatus');
}
