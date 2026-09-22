'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isPreviewableRole } from '@/server/staff/permissions';
import { PREVIEW_COOKIE, requireActualOps } from '@/server/staff/session';
import { fail, text, type ActionState } from './shared';

/**
 * "See it the way they see it."
 *
 * This is a permission preview, not impersonation. Nothing signs in as
 * anybody: the owner's own session stays exactly as it is, and a cookie asks
 * the capability layer to pretend the account carries less authority than it
 * does. `clampPreview` can only move down the ladder, so the worst a forged
 * cookie achieves is locking yourself out of your own tools until you clear
 * it — which the banner offers in one tap.
 *
 * It is checked against the account's REAL role, otherwise an owner
 * previewing as an employee would no longer be allowed to stop.
 */
export async function setRolePreview(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireActualOps('system.preview_role');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Only the owner can preview the app as another role.');
  }
  const role = text(form, 'role');
  const store = await cookies();
  if (!role || role === 'off') {
    store.delete(PREVIEW_COOKIE);
    revalidatePath('/staff', 'layout');
    return { ok: true, message: 'Back to your own account.' };
  }
  if (!isPreviewableRole(role)) return fail('Pick Staff, Manager or Contractor.');
  store.set(PREVIEW_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 });
  revalidatePath('/staff', 'layout');
  return { ok: true, message: `Previewing as ${role === 'employee' ? 'staff' : role}. Nothing you do is hidden from the audit trail.` };
}
