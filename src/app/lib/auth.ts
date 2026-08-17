import type { Session } from '@supabase/supabase-js';
import { mobileToAuthEmail, supabase } from './supabase';

export type Role = 'super' | 'building_staff' | 'student';

export interface AppUser {
  authId: string;            // auth.users.id (uuid)
  role: Role;
  recordId: number;          // admins.id or students.id
  buildingId: number | null; // assigned_building_id (admins) or building_id (students)
  name: string | null;
  email: string;
}

/** Admin login uses email + password (Supabase Auth). */
export async function loginAdmin(email: string, password: string): Promise<AppUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error('No session returned from Supabase');

  const adminRow = await fetchAdminRow(session.user.id);
  if (!adminRow) {
    await supabase.auth.signOut();
    throw new Error(
      'This account is not registered as an admin. Ask the super-admin to add it.',
    );
  }

  return {
    authId: session.user.id,
    role: adminRow.role,
    recordId: adminRow.id,
    buildingId: adminRow.assigned_building_id,
    name: adminRow.name,
    email: session.user.email!,
  };
}

/** Student login: mobile + password mapped to synthetic email. */
export async function loginStudent(mobile: string, password: string): Promise<AppUser> {
  const email = mobileToAuthEmail(mobile);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error('No session returned from Supabase');

  const studentRow = await fetchStudentRow(session.user.id);
  if (!studentRow) {
    await supabase.auth.signOut();
    throw new Error('This mobile is not registered as a student.');
  }

  return {
    authId: session.user.id,
    role: 'student',
    recordId: studentRow.id,
    buildingId: studentRow.building_id,
    name: studentRow.name,
    email: session.user.email!,
  };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Resolves the current Supabase session into an AppUser, or null if not signed in
 *  / if the auth user has no admin or student record yet. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session) return null;

  const adminRow = await fetchAdminRow(session.user.id);
  if (adminRow) {
    return {
      authId: session.user.id,
      role: adminRow.role,
      recordId: adminRow.id,
      buildingId: adminRow.assigned_building_id,
      name: adminRow.name,
      email: session.user.email!,
    };
  }
  const studentRow = await fetchStudentRow(session.user.id);
  if (studentRow) {
    return {
      authId: session.user.id,
      role: 'student',
      recordId: studentRow.id,
      buildingId: studentRow.building_id,
      name: studentRow.name,
      email: session.user.email!,
    };
  }
  return null;
}

async function fetchAdminRow(authUserId: string) {
  const { data, error } = await supabase
    .from('admins')
    .select('id, role, assigned_building_id, name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        id: number;
        role: Role;
        assigned_building_id: number | null;
        name: string | null;
      }
    | null;
}

async function fetchStudentRow(authUserId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('id, building_id, name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        id: number;
        building_id: number | null;
        name: string;
      }
    | null;
}
