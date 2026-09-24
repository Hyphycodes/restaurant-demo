'use server';

import type { EmployeeStatus, EmploymentType } from '@/content/staff-types';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';
import { findAuthUser, normalizeEmail } from '@/server/owner-onboarding';
import { recordOpsAudit } from '@/server/staff/audit';
import { withEmailDetails } from '@/server/staff/emails';
import { createEmployee, findEmployeeByEmail, getEmployee, updateEmployeeManagement, type EmployeeInput } from '@/server/staff/employees';
import { saveLocation } from '@/server/staff/locations';
import { notify } from '@/server/staff/notifications';
import { provisionRequirements } from '@/server/staff/requirements';
import { assignRequiredModules } from '@/server/staff/training';
import { bool, fail, isoDate, list, optional, runOps, savedOps, text, type ActionState } from './shared';

/**
 * Adding an employee is three things: the person (an `employees` row), the
 * sign-in (a Supabase auth user with profiles.role = 'staff', invited by
 * email) and the onboarding (their requirement rows and required training).
 * The person is created first so a failed invitation never loses the record.
 */

const STATUSES: EmployeeStatus[] = ['invited', 'active', 'on_leave', 'inactive'];
const TYPES: EmploymentType[] = ['full_time', 'part_time', 'seasonal', 'on_call'];

function employeeInputFrom(form: FormData, fallbackLocation: string): { input: EmployeeInput; error: string | null } {
  const firstName = text(form, 'firstName');
  const email = text(form, 'email').toLowerCase();
  if (!firstName) return { input: null as never, error: 'Enter their first name.' };
  if (!email || !email.includes('@')) return { input: null as never, error: 'Enter a valid email. It is how they sign in.' };
  const positionIds = list(form, 'positions');
  const status = text(form, 'status') as EmployeeStatus;
  const type = text(form, 'employmentType') as EmploymentType;
  const primaryLocationId = optional(form, 'primaryLocationId') ?? fallbackLocation;
  return {
    input: {
      firstName,
      lastName: text(form, 'lastName'),
      preferredName: optional(form, 'preferredName'),
      email,
      phone: optional(form, 'phone'),
      status: STATUSES.includes(status) ? status : 'invited',
      employmentType: TYPES.includes(type) ? type : 'part_time',
      primaryLocationId,
      positionIds,
      primaryPositionId: optional(form, 'primaryPositionId') ?? positionIds[0] ?? null,
      locationIds: list(form, 'locations').length > 0 ? list(form, 'locations') : [primaryLocationId],
      hireDate: isoDate(optional(form, 'hireDate')),
      startDate: isoDate(optional(form, 'startDate')),
      managerEmployeeId: optional(form, 'managerEmployeeId'),
    },
    error: null,
  };
}

/**
 * Creates a sign-in and emails the invitation. Returns a sentence about what
 * happened, because "invited" and "they already had an account" and "the
 * email bounced" are three different things a manager needs to know.
 *
 * `role` is the account tier the new profile gets: `staff` for an employee,
 * `contractor` for a DJ or an instructor. A contractor profile carries no
 * content capability and, in the operational matrix, only their own
 * bookings — so an invitation cannot accidentally open the restaurant.
 */
export async function inviteSignIn(email: string, name: string, invitedBy: string, role: 'staff' | 'contractor' = 'staff'): Promise<{ userId: string | null; note: string }> {
  if (!isSupabaseConfigured()) return { userId: null, note: 'No sign-in was created: this is the local development copy.' };
  const service = getServiceClient();
  if (!service) return { userId: null, note: 'No sign-in was created: the account service is not connected.' };
  const normalized = normalizeEmail(email);
  let user = await findAuthUser(service, normalized);
  if (!user) {
    const { data, error } = await service.auth.admin.createUser({ email: normalized, email_confirm: false, user_metadata: { name, invited_by: invitedBy } });
    if (error) return { userId: null, note: `No sign-in was created (${error.message}). Add it again from their profile.` };
    user = data.user;
  }
  if (!user) return { userId: null, note: 'No sign-in was created.' };
  const { data: profile } = await service.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (!profile) {
    const { error } = await service.from('profiles').upsert({ user_id: user.id, name, role, active: true, sections: [] }, { onConflict: 'user_id' });
    if (error) return { userId: user.id, note: `Sign-in exists but the staff profile could not be saved (${error.message}).` };
  }
  if (user.email_confirmed_at) return { userId: user.id, note: 'They already had a verified sign-in, so they can open the staff app straight away.' };
  const invited = await service.auth.admin.inviteUserByEmail(normalized, { redirectTo: `${SITE_URL}/auth/activate`, data: { name, invited_by: invitedBy } });
  if (invited.error) return { userId: user.id, note: `Sign-in created, but the invitation email could not be sent (${invited.error.message}). They can request a link from the staff sign-in page.` };
  return { userId: user.id, note: 'An invitation email is on its way to them.' };
}

export async function addEmployee(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.manage_team', async ({ db, elevated, context }) => {
    const { input, error } = employeeInputFrom(form, context.location.id);
    if (error) return fail(error);
    if (await findEmployeeByEmail(db, input.email)) return fail('Someone with that email is already on the team.', { email: 'Already on the team.' });
    const row = await createEmployee(db, input, context.staff.source === 'supabase' ? context.staff.id : null);
    const employee = (await getEmployee(db, String(row.id)))!;
    await provisionRequirements(elevated, employee);
    const modules = await assignRequiredModules(elevated, employee, context.staff);
    await recordOpsAudit(context.staff, 'employee.added', 'employee', employee.id, { after: { name: employee.fullName, email: employee.email, positions: input.positionIds } });
    let note = '';
    if (bool(form, 'invite')) {
      const invite = await inviteSignIn(input.email, employee.fullName, context.staff.name || context.staff.email);
      if (invite.userId) await elevated.update('employees', employee.id, { user_id: invite.userId });
      note = invite.note;
      await notify(
        withEmailDetails(
          { employeeIds: [employee.id], kind: 'welcome', title: `Welcome to Casa Aurelia, ${employee.displayName}`, href: '/staff/onboarding', email: { subject: 'Welcome to Casa Aurelia', intro: `${context.staff.name || 'A manager'} added you to the Casa Aurelia team. Everything you need for work — your schedule, training, tasks and documents — is in the Casa Aurelia staff app.`, cta: 'Start onboarding' } },
          { headline: `Welcome to Casa Aurelia, ${employee.displayName}.`, details: [...(employee.primaryPositionId ? [{ label: 'Position', value: employee.primaryPositionId }] : []), { label: 'Location', value: context.location.name }, ...(input.startDate ? [{ label: 'Start date', value: input.startDate }] : [])], note: 'Finish your onboarding checklist before your first shift.' },
        ),
      );
    }
    return { ...savedOps(`${employee.displayName} added.${modules ? ` ${modules} required training ${modules === 1 ? 'module' : 'modules'} assigned.` : ''} ${note}`.trim()), affected: [`/staff/team/${employee.id}`] };
  });
}

export async function saveEmployee(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.manage_team', async ({ db, elevated, context }) => {
    const id = text(form, 'id');
    const before = await getEmployee(db, id);
    if (!before) return fail('That employee no longer exists.');
    const { input, error } = employeeInputFrom(form, context.location.id);
    if (error) return fail(error);
    if (before.id === context.employee?.id && input.status === 'inactive') return fail('You cannot deactivate yourself.');
    await updateEmployeeManagement(db, id, input);
    const after = (await getEmployee(db, id))!;
    await provisionRequirements(elevated, after);
    await recordOpsAudit(context.staff, before.status !== after.status ? `employee.${after.status}` : 'employee.edited', 'employee', id, { before: { status: before.status, positions: before.positionIds, email: before.email }, after: { status: after.status, positions: after.positionIds, email: after.email } });
    // Deactivating also closes the sign-in, so an ex-employee cannot open the app.
    if (after.status === 'inactive' && after.userId && isSupabaseConfigured()) {
      await getServiceClient()?.from('profiles').update({ active: false }).eq('user_id', after.userId);
    }
    if (before.status === 'inactive' && after.status !== 'inactive' && after.userId && isSupabaseConfigured()) {
      await getServiceClient()?.from('profiles').update({ active: true }).eq('user_id', after.userId);
    }
    return savedOps(after.status === 'inactive' ? `${after.displayName} deactivated. They can no longer sign in to the staff app.` : 'Saved.');
  });
}

export async function sendInvitation(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.manage_team', async ({ db, elevated, context }) => {
    const employee = await getEmployee(db, text(form, 'employeeId'));
    if (!employee) return fail('That employee no longer exists.');
    const invite = await inviteSignIn(employee.email, employee.fullName, context.staff.name || context.staff.email);
    if (invite.userId && !employee.userId) await elevated.update('employees', employee.id, { user_id: invite.userId });
    await recordOpsAudit(context.staff, 'employee.invited', 'employee', employee.id, { after: { email: employee.email } });
    return savedOps(invite.note);
  });
}

/**
 * Owner only: the account tier behind a person. A manager cannot raise
 * anyone — including themselves — to owner, and the database policy from
 * migration 0003 refuses it too.
 */
export async function changeAccess(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.manage_access', async ({ db, context }) => {
    const employee = await getEmployee(db, text(form, 'employeeId'));
    if (!employee?.userId) return fail('This person has no sign-in yet. Send the invitation first.');
    const role = text(form, 'role');
    if (!['owner', 'admin', 'staff'].includes(role)) return fail('Pick Employee, Manager or Owner.');
    if (employee.userId === context.staff.id && role !== 'owner') return fail('You cannot remove your own owner access.');
    // `db` carries the signed-in person's session, so migration 0003's
    // profiles_owner_write is what actually decides this — not the capability
    // check above, which only keeps the button off a manager's screen.
    try {
      await db.update('profiles', employee.userId, { role });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(/policy|permission|42501/i.test(message) ? 'Only the owner can change what an account is allowed to do.' : message);
    }
    await recordOpsAudit(context.staff, 'access.changed', 'employee', employee.id, { before: { role: employee.accessRole }, after: { role } });
    return savedOps(`${employee.displayName} is now ${role === 'owner' ? 'an Owner' : role === 'admin' ? 'a Manager' : 'an Employee'}.`);
  });
}

export async function saveLocationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('locations.manage', async ({ db, context }) => {
    const name = text(form, 'name');
    if (!name) return fail('Give the location a name.');
    const slug = (optional(form, 'slug') ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = optional(form, 'id');
    const location = await saveLocation(db, { id: id ?? undefined, slug, name, shortName: optional(form, 'shortName'), street: optional(form, 'street'), locality: optional(form, 'locality'), region: optional(form, 'region'), postalCode: optional(form, 'postalCode'), timezone: text(form, 'timezone') || 'America/Chicago', phone: optional(form, 'phone'), active: !bool(form, 'inactive') });
    await recordOpsAudit(context.staff, id ? 'location.edited' : 'location.added', 'location', location.id, { after: { name, slug } });
    return savedOps(id ? 'Location saved.' : `${name} added. Employees, shifts and events can now belong to it.`);
  });
}
