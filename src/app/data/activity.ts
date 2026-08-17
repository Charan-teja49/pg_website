import { supabase, pgError } from '../lib/supabase';

export type ActivityKind = 'payment' | 'complaint' | 'room_request' | 'student';

export interface ActivityItem {
  kind: ActivityKind;
  at: string; // ISO timestamp
  title: string;
  subtitle: string;
  building_short_name: string | null;
}

/**
 * Aggregate recent events across the system into a single feed.
 * Pass `buildingId` to scope to one building, `null` for cross-building.
 */
export async function fetchRecentActivity(
  buildingId: number | null,
  limit = 8,
): Promise<ActivityItem[]> {
  const out: ActivityItem[] = [];

  // -- Payments
  {
    let q = supabase
      .from('payments')
      .select(
        'id, amount, payment_mode, payment_date, created_at, students!inner(name, building_id, buildings(short_name))',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (buildingId !== null) q = q.eq('students.building_id', buildingId);
    const { data, error } = await q;
    if (error) throw pgError(error, 'activity.payments');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (data ?? []) as any[]) {
      out.push({
        kind: 'payment',
        at: p.created_at,
        title: `${p.students?.name ?? 'Student'} paid ₹${Number(p.amount).toLocaleString('en-IN')}`,
        subtitle: `${p.payment_mode} · ${p.payment_date}`,
        building_short_name: p.students?.buildings?.short_name ?? null,
      });
    }
  }

  // -- Complaints
  {
    let q = supabase
      .from('complaints')
      .select(
        'id, category, description, status, created_at, students!inner(name, building_id, buildings(short_name))',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (buildingId !== null) q = q.eq('students.building_id', buildingId);
    const { data, error } = await q;
    if (error) throw pgError(error, 'activity.complaints');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (data ?? []) as any[]) {
      out.push({
        kind: 'complaint',
        at: c.created_at,
        title: `${c.students?.name ?? 'Student'} · ${c.category} complaint`,
        subtitle:
          (c.description ?? '').slice(0, 80) +
          ((c.description ?? '').length > 80 ? '…' : ''),
        building_short_name: c.students?.buildings?.short_name ?? null,
      });
    }
  }

  // -- Room change requests
  {
    let q = supabase
      .from('room_change_requests')
      .select(
        'id, reason, status, created_at, students!inner(name, building_id, buildings(short_name))',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (buildingId !== null) q = q.eq('students.building_id', buildingId);
    const { data, error } = await q;
    if (error) throw pgError(error, 'activity.roomRequests');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? []) as any[]) {
      out.push({
        kind: 'room_request',
        at: r.created_at,
        title: `${r.students?.name ?? 'Student'} · room change (${r.status})`,
        subtitle:
          (r.reason ?? '').slice(0, 80) +
          ((r.reason ?? '').length > 80 ? '…' : ''),
        building_short_name: r.students?.buildings?.short_name ?? null,
      });
    }
  }

  // -- New students
  {
    let q = supabase
      .from('students')
      .select(
        'id, name, created_at, buildings(short_name)',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (buildingId !== null) q = q.eq('building_id', buildingId);
    const { data, error } = await q;
    if (error) throw pgError(error, 'activity.students');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (data ?? []) as any[]) {
      out.push({
        kind: 'student',
        at: s.created_at,
        title: `${s.name} joined`,
        subtitle: 'New admission',
        building_short_name: s.buildings?.short_name ?? null,
      });
    }
  }

  out.sort((a, b) => (a.at < b.at ? 1 : -1));
  return out.slice(0, limit);
}
