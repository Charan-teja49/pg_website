import { supabase, pgError } from '../lib/supabase';

export type VisitorStatus = 'Pending' | 'Approved' | 'Rejected';

export interface VisitorRow {
  id: number;
  building_id: number;
  student_id: number | null;
  visitor_name: string;
  visitor_mobile: string | null;
  relation: string | null;
  purpose: string | null;
  status: VisitorStatus;
  requested_arrival: string | null;
  decision_note: string | null;
  entered_at: string | null;
  exited_at: string | null;
  id_proof_note: string | null;
  notes: string | null;
  created_at: string;
}

export interface VisitorRowEnriched extends VisitorRow {
  student_name: string | null;
  building_short_name: string | null;
}

export interface VisitorRequestInput {
  building_id: number;
  student_id: number; // request is always tied to a student
  visitor_name: string;
  visitor_mobile: string | null;
  relation: string | null;
  purpose: string | null;
  requested_arrival: string | null;
  notes?: string | null;
}

export interface WalkInVisitorInput {
  building_id: number;
  student_id: number | null;
  visitor_name: string;
  visitor_mobile: string | null;
  relation: string | null;
  purpose: string | null;
  id_proof_note: string | null;
  notes?: string | null;
}

export class VisitorsTableMissingError extends Error {
  constructor() {
    super(
      'The `visitors` table is not set up yet. Paste supabase/migrations/0005_visitor_log.sql and 0008_visitor_requests.sql into the Supabase SQL Editor to enable this page.',
    );
    this.name = 'VisitorsTableMissingError';
  }
}

function isTableMissing(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = e as any;
  const code = any.code ?? '';
  const msg = String(any.message ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  if (/relation .*visitors.* does not exist/i.test(msg)) return true;
  if (/could not find the table.*visitors/i.test(msg)) return true;
  return false;
}

/** Admin: every visitor record in a building (or all buildings if null). */
export async function fetchVisitorsForBuilding(
  buildingId: number | null,
): Promise<VisitorRowEnriched[]> {
  let q = supabase
    .from('visitors')
    .select('*, students(name), buildings(short_name)')
    .order('created_at', { ascending: false });
  if (buildingId !== null) q = q.eq('building_id', buildingId);
  const { data, error } = await q;
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'fetchVisitorsForBuilding');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((v) => ({
    ...v,
    student_name: v.students?.name ?? null,
    building_short_name: v.buildings?.short_name ?? null,
  }));
}

/** Student: their own visitor requests. */
export async function fetchStudentVisitorRequests(
  studentId: number,
): Promise<VisitorRow[]> {
  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'fetchStudentVisitorRequests');
  }
  return (data ?? []) as VisitorRow[];
}

/** Student: submit a request for an upcoming visitor. */
export async function createVisitorRequest(
  input: VisitorRequestInput,
): Promise<VisitorRow> {
  const { data, error } = await supabase
    .from('visitors')
    .insert({
      ...input,
      status: 'Pending',
      entered_at: null,
    })
    .select()
    .single();
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'createVisitorRequest');
  }
  return data as VisitorRow;
}

/** Admin: log a visitor who is physically here right now (skip approval flow). */
export async function createWalkInVisitor(
  input: WalkInVisitorInput,
): Promise<VisitorRow> {
  const { data, error } = await supabase
    .from('visitors')
    .insert({
      ...input,
      status: 'Approved',
      entered_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'createWalkInVisitor');
  }
  return data as VisitorRow;
}

/** Admin: approve a pending request. Optionally with a note. */
export async function approveVisitor(id: number, note?: string): Promise<void> {
  const patch: Record<string, unknown> = { status: 'Approved' };
  if (note) patch.decision_note = note;
  const { error } = await supabase.from('visitors').update(patch).eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'approveVisitor');
  }
}

/** Admin: reject a pending request with a reason. */
export async function rejectVisitor(id: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('visitors')
    .update({ status: 'Rejected', decision_note: note })
    .eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'rejectVisitor');
  }
}

/** Admin: visitor has now physically arrived. */
export async function markEntry(
  id: number,
  when: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from('visitors')
    .update({ entered_at: when, status: 'Approved' })
    .eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'markEntry');
  }
}

/** Admin: visitor has left. */
export async function markExit(
  id: number,
  when: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from('visitors')
    .update({ exited_at: when })
    .eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'markExit');
  }
}

/** Student: cancel a Pending request you submitted. */
export async function cancelVisitorRequest(id: number): Promise<void> {
  const { error } = await supabase.from('visitors').delete().eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'cancelVisitorRequest');
  }
}

export async function deleteVisitor(id: number): Promise<void> {
  const { error } = await supabase.from('visitors').delete().eq('id', id);
  if (error) {
    if (isTableMissing(error)) throw new VisitorsTableMissingError();
    throw pgError(error, 'deleteVisitor');
  }
}
