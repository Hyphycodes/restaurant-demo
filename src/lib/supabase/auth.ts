import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSessionClient, isSupabaseConfigured } from './server';

export type Role = 'owner' | 'admin' | 'editor';

export interface Staff {
  user: User;
  role: Role;
  name: string;
}

/**
 * Resolves the signed-in staff member and their role.
 *
 * Every admin page and every mutation calls this. Returning null means "not
 * signed in or has no profile row" — which is treated as no access, not as a
 * default role.
 */
export async function getStaff(): Promise<Staff | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await getSessionClient();
  if (!supabase) return null;

  // getUser() re-validates with the auth server. getSession() alone would trust
  // a cookie the client could have forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;

  return { user, role: data.role as Role, name: (data.name as string) ?? '' };
}

export function canEdit(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function canAdminister(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Server-side guard for mutations. Throws rather than returning a flag, so a
 * forgotten check cannot silently fall through to a write.
 */
export async function requireRole(minimum: 'editor' | 'admin'): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new Error('Not signed in.');

  const allowed = minimum === 'admin' ? canAdminister(staff.role) : canEdit(staff.role);
  if (!allowed) throw new Error('You do not have permission to make this change.');

  return staff;
}
