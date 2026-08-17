import { supabase, pgError } from '../lib/supabase';

export interface AnnouncementRow {
  id: number;
  building_id: number | null; // null = global
  title: string;
  message: string;
  created_at: string;
}

export interface AnnouncementRowEnriched extends AnnouncementRow {
  building_short_name: string | null; // null when building_id is null (global)
}

/**
 * When `buildingId` is a number: returns that building's announcements + globals.
 * When `null`: returns every announcement across the system.
 */
export async function fetchAnnouncements(
  buildingId: number | null,
): Promise<AnnouncementRowEnriched[]> {
  let q = supabase
    .from('announcements')
    .select('*, buildings(short_name)')
    .order('created_at', { ascending: false });
  if (buildingId !== null) {
    q = q.or(`building_id.eq.${buildingId},building_id.is.null`);
  }
  const { data, error } = await q;
  if (error) throw pgError(error, 'fetchAnnouncements');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    building_short_name: a.buildings?.short_name ?? null,
  }));
}

export async function createAnnouncement(input: {
  building_id: number | null;
  title: string;
  message: string;
}): Promise<AnnouncementRow> {
  const { data, error } = await supabase
    .from('announcements')
    .insert(input)
    .select()
    .single();
  if (error) throw pgError(error, 'createAnnouncement');
  return data as AnnouncementRow;
}

export async function updateAnnouncement(
  id: number,
  patch: Partial<AnnouncementRow>,
) {
  const { error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', id);
  if (error) throw pgError(error, 'updateAnnouncement');
}

export async function deleteAnnouncement(id: number) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw pgError(error, 'deleteAnnouncement');
}
