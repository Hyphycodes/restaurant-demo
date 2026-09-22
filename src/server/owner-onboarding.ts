import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Owner-designated bootstrap identity. Possession of this mailbox must be verified by Auth. */
export const INITIAL_OWNER_EMAIL = 'owner@example.invalid';
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findAuthUser(client: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error('Account lookup unavailable.');
    const user = data.users.find(user => normalizeEmail(user.email ?? '') === normalizeEmail(email));
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error('Account lookup unavailable.');
}

/** Never elevates an unverified email, replaces another owner or reactivates a disabled account. */
export async function completeOwnerOnboarding(client: SupabaseClient, user: User): Promise<void> {
  if (normalizeEmail(user.email ?? '') !== INITIAL_OWNER_EMAIL || !user.email_confirmed_at) return;
  const { data: existing, error: profileError } = await client.from('profiles').select('role,active').eq('user_id', user.id).maybeSingle();
  if (profileError) throw new Error('Owner setup unavailable.');
  if (existing?.active === false || existing?.role === 'owner') return;
  const { data: owners, error } = await client.from('profiles').select('user_id').eq('role', 'owner').limit(1);
  if (error) throw new Error('Owner setup unavailable.');
  if (owners?.length) return;
  const { error: writeError } = await client.from('profiles').upsert({user_id:user.id, name:'Alessandro Costa', role:'owner', active:true, sections:[]}, {onConflict:'user_id'});
  if (writeError) throw new Error('Owner setup unavailable.');
}
