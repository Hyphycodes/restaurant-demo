'use server';

import { addAvailabilityException, removeAvailabilityException, saveWeeklyAvailability } from '@/server/staff/availability';
import { updateOwnProfile } from '@/server/staff/employees';
import { employeeFilePath, fileProblem, storeEmployeeFile } from '@/server/staff/storage';
import { minutesFromClock } from '@/lib/staff/time';
import { bool, fail, integer, isoDate, optional, runOps, savedOps, text, type ActionState } from './shared';

/** The employee's own profile: the fields the column guard in 0022 lets them change. */
export async function saveOwnProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const phone = optional(form, 'phone');
    if (phone && phone.replace(/\D/g, '').length < 10) return fail('Enter a phone number with the area code.', { phone: 'Needs the area code.' });
    const language = text(form, 'preferredLanguage') === 'es' ? 'es' : 'en';
    await updateOwnProfile(db, employee.id, {
      preferredName: optional(form, 'preferredName'),
      phone,
      emergencyContactName: optional(form, 'emergencyContactName'),
      emergencyContactPhone: optional(form, 'emergencyContactPhone'),
      emergencyContactRelationship: optional(form, 'emergencyContactRelationship'),
      shirtSize: optional(form, 'shirtSize'),
      preferredLanguage: language,
      birthdayMonth: integer(form, 'birthdayMonth'),
      birthdayDay: integer(form, 'birthdayDay'),
      notificationEmail: bool(form, 'notificationEmail'),
    });
    return savedOps('Profile saved.');
  });
}

export async function uploadOwnPhoto(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const file = form.get('photo');
    if (!(file instanceof File)) return fail('Choose a photo first.');
    const problem = fileProblem(file);
    if (problem) return fail(problem);
    const stored = await storeEmployeeFile(employeeFilePath(employee.id, 'photo', file.name), file);
    if ('error' in stored) return fail(stored.error);
    await db.update('employees', employee.id, { photo_path: stored.path });
    return savedOps('Photo updated.');
  });
}

/** Seven weekdays in, as `d0..d6` fields: available, from, until. */
export async function saveAvailability(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('availability.manage_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const available = bool(form, `d${weekday}`);
      const from = text(form, `d${weekday}from`);
      const until = text(form, `d${weekday}until`);
      return {
        weekday,
        available,
        startMinutes: from ? minutesFromClock(from) : null,
        endMinutes: until ? minutesFromClock(until) : null,
        note: optional(form, `d${weekday}note`),
      };
    });
    const bad = week.find((day) => day.available && day.startMinutes !== null && day.endMinutes !== null && day.endMinutes <= day.startMinutes);
    if (bad) return fail('An "until" time has to be after its "from" time.');
    await saveWeeklyAvailability(db, employee.id, week);
    return savedOps('Availability saved. Managers see it when they schedule you.');
  });
}

export async function addException(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('availability.manage_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const onDate = isoDate(optional(form, 'onDate'));
    if (!onDate) return fail('Pick a date.', { onDate: 'Pick a date.' });
    const available = bool(form, 'available');
    const from = text(form, 'from');
    const until = text(form, 'until');
    await addAvailabilityException(db, employee.id, {
      onDate,
      available,
      startMinutes: available && from ? minutesFromClock(from) : null,
      endMinutes: available && until ? minutesFromClock(until) : null,
      note: optional(form, 'note'),
    });
    return savedOps(available ? `Marked available on ${onDate}.` : `Marked unavailable on ${onDate}.`);
  });
}

export async function removeException(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('availability.manage_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    await removeAvailabilityException(db, employee.id, text(form, 'id'));
    return savedOps('Removed.');
  });
}
