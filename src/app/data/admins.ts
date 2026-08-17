import { supabase, pgError } from '../lib/supabase';

export type AdminRole = 'super' | 'building_staff';

export interface AdminRow {
  id: number;
  auth_user_id: string | null;
  username: string;
  mobile: string | null;
  name: string | null;
  role: AdminRole;
  assigned_building_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminRowEnriched extends AdminRow {
  assigned_building_short_name: string | null;
}

export async function fetchAdmins(): Promise<AdminRowEnriched[]> {
  const { data, error } = await supabase
    .from('admins')
    .select('*, buildings:assigned_building_id(short_name)')
    .order('id');
  if (error) throw pgError(error, 'fetchAdmins');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    assigned_building_short_name: a.buildings?.short_name ?? null,
  }));
}

export async function setAdminActive(id: number, active: boolean) {
  const { error } = await supabase
    .from('admins')
    .update({ is_active: active })
    .eq('id', id);
  if (error) throw pgError(error, 'setAdminActive');
}

export async function deleteAdmin(id: number) {
  const { error } = await supabase.from('admins').delete().eq('id', id);
  if (error) throw pgError(error, 'deleteAdmin');
}
