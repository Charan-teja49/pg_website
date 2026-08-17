import { supabase, pgError } from '../lib/supabase';

export type RoomChangeStatus = 'Pending' | 'Approved' | 'Rejected';

export interface RoomChangeRequestRow {
  id: number;
  student_id: number;
  current_bed_id: number | null;
  requested_unit_id: number | null;
  reason: string;
  status: RoomChangeStatus;
  created_at: string;
}

export interface RoomChangeRequestRowEnriched extends RoomChangeRequestRow {
  student_name: string;
  building_short_name: string | null;
}

/** Pass `null` for cross-building list. */
export async function fetchRoomChangeRequestsForBuilding(
  buildingId: number | null,
): Promise<RoomChangeRequestRowEnriched[]> {
  let q = supabase
    .from('room_change_requests')
    .select(
      '*, students!inner(name, building_id, buildings(short_name))',
    )
    .order('created_at', { ascending: false });
  if (buildingId !== null) q = q.eq('students.building_id', buildingId);
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchRoomChangeRequestsForBuilding');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    student_name: r.students?.name ?? '—',
    building_short_name: r.students?.buildings?.short_name ?? null,
  }));
}

export async function fetchStudentRoomChangeRequests(
  studentId: number,
): Promise<RoomChangeRequestRow[]> {
  const { data, error } = await supabase
    .from('room_change_requests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw pgError(error, 'fetchStudentRoomChangeRequests');
  return (data ?? []) as RoomChangeRequestRow[];
}

export async function createRoomChangeRequest(input: {
  student_id: number;
  current_bed_id: number | null;
  requested_unit_id: number | null;
  reason: string;
}): Promise<RoomChangeRequestRow> {
  const { data, error } = await supabase
    .from('room_change_requests')
    .insert({ ...input, status: 'Pending' })
    .select()
    .single();
  if (error) throw pgError(error, 'createRoomChangeRequest');
  return data as RoomChangeRequestRow;
}

export async function updateRoomChangeRequestStatus(
  id: number,
  status: RoomChangeStatus,
) {
  const { error } = await supabase
    .from('room_change_requests')
    .update({ status })
    .eq('id', id);
  if (error) throw pgError(error, 'updateRoomChangeRequestStatus');
}
