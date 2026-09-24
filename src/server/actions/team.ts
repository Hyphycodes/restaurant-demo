'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { findAuthUser, normalizeEmail } from '../owner-onboarding';
import { z } from 'zod';
import { isLocalDb } from '@/lib/db';
import { getServiceClient, getSessionClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';
import { signInLocally, signOutLocally, type Role } from '../auth';
import { run, saved, type ActionState } from './shared';

/**
 * Sign-in and staff accounts.
 *
 * Roles are Owner-only, deliberately. In the 0001 policy a Manager could change
 * roles, which meant a Manager could promote themselves to Owner — the classic
 * privilege-escalation shape. Migration 0003 restricts it in the database and
 * this file matches.
 */

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, message: 'Enter your email and password.' };
  }

  const supabase = await getSessionClient();
  if (!supabase) {
    return { ok: false, message: 'The content system is not connected yet.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately vague: do not reveal whether the email exists.
    return { ok: false, message: 'That email and password did not match. Please try again.' };
  }

  redirect(safeNext(formData.get('next')) ?? '/admin');
}

/** Only a path on this site, so a sign-in link cannot bounce someone elsewhere. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === 'string' ? value.trim() : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}

/** Development sign-in. Refuses outright anywhere the local database is not live. */
export async function signInAs(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isLocalDb()) {
    return { ok: false, message: 'Sign in with your email and password.' };
  }
  const role = String(formData.get('role') ?? '') as Role;
  if (!['owner', 'admin', 'editor', 'staff', 'contractor'].includes(role)) {
    return { ok: false, message: 'Pick an account.' };
  }
  await signInLocally(role);
  redirect(safeNext(formData.get('next')) ?? (role === 'staff' || role === 'contractor' ? '/staff' : '/admin'));
}

export async function signOut(): Promise<void> {
  const supabase = await getSessionClient();
  await supabase?.auth.signOut();
  await signOutLocally();
  redirect('/admin/login');
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'editor', 'staff', 'contractor']),
  sections: z.string().max(200).optional(),
  active: z.coerce.boolean(),
});

export async function saveTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('team.manage', async ({ db, staff }) => {
    const parsed = roleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not save that account.' };
    const value = parsed.data;

    // Locking yourself out of your own admin is not a change anyone means to make.
    if (value.userId === staff.id && (value.role !== 'owner' || !value.active)) {
      return {
        ok: false,
        message: 'You cannot remove your own owner access. Ask another owner to do it.',
      };
    }

    await db.update('profiles', value.userId, {
      role: value.role,
      active: value.active,
      sections: value.sections ? value.sections.split(',').filter(Boolean) : [],
    });

    return saved('Account updated.');
  });
}

/** Owner-only provisioning; recipients prove mailbox ownership through the sign-in link. */
export async function addTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('team.manage', async ({ staff }) => {
    const parsed = z.object({email:z.string().trim().email().max(254),name:z.string().trim().min(1).max(100),role:z.enum(['admin','editor'])}).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return {ok:false,message:'Enter a name, valid email and staff role.'};
    const service = getServiceClient();
    if (!service) return {ok:false,message:'Account creation is unavailable.'};
    const email = normalizeEmail(parsed.data.email);
    let user = await findAuthUser(service,email);
    if (user) {
      const {data:profile,error} = await service.from('profiles').select('role').eq('user_id',user.id).maybeSingle();
      if (error) throw error;
      if (profile) return {ok:false,message:'This account already exists. Update its permissions in the list below.'};
    } else {
      const {data,error} = await service.auth.admin.createUser({email,email_confirm:false,user_metadata:{name:parsed.data.name,invited_by:staff.name || staff.email || null}});
      if (error) throw error;
      user = data.user;
    }
    if (!user) return {ok:false,message:'Could not create the account.'};
    const {error} = await service.from('profiles').upsert({user_id:user.id,name:parsed.data.name,role:parsed.data.role,active:true,sections:[]},{onConflict:'user_id'});
    if (error) throw error;
    revalidatePath('/admin/team');
    // The invitation goes through Supabase Auth, which is what makes the link
    // a real credential. With the auth email hook pointed at this site it
    // arrives as the branded Casa Aurelia staff invitation; without it, Supabase's
    // own template. An already-verified address gets no invite — they sign in.
    if (user.email_confirmed_at) return saved(`Account created for ${email}. They already have a verified sign-in, so they can use the staff sign-in page straight away.`);
    const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${SITE_URL}/auth/activate`, data: { name: parsed.data.name, invited_by: staff.name || staff.email || null } });
    if (invited.error) return saved(`Account created for ${email}, but the invitation email could not be sent (${invited.error.message}). Send them the staff sign-in page; they can request their own link.`);
    return saved(`Account created and an invitation emailed to ${email}. The link works once and expires; they can always request a fresh one from the staff sign-in page.`);
  });
}
