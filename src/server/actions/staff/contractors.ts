'use server';

import type { ContractorService } from '@/content/staff-types';
import { recordOpsAudit } from '@/server/staff/audit';
import { getContractor, markBookingPaid, saveBooking, saveContractor } from '@/server/staff/contractors';
import { bool, cents, fail, isoDate, optional, runOps, savedOps, text, type ActionState } from './shared';

const SERVICES: ContractorService[] = ['dj', 'instructor', 'painter', 'band', 'performer', 'photographer', 'security', 'other'];

export async function saveContractorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('contractors.manage', async ({ db, context }) => {
    const name = text(form, 'name');
    if (!name) return fail('Enter a name.');
    const service = text(form, 'serviceType') as ContractorService;
    const w9 = text(form, 'w9Status');
    const id = optional(form, 'id');
    const row = await saveContractor(db, id, {
      name,
      companyName: optional(form, 'companyName'),
      phone: optional(form, 'phone'),
      email: optional(form, 'email'),
      serviceType: SERVICES.includes(service) ? service : 'other',
      defaultRateCents: cents(form, 'defaultRate'),
      paymentMethodNote: optional(form, 'paymentMethodNote'),
      w9Status: ['missing', 'requested', 'received'].includes(w9) ? (w9 as 'missing' | 'requested' | 'received') : 'missing',
      notes: optional(form, 'notes'),
      active: !bool(form, 'archived'),
    });
    await recordOpsAudit(context.staff, id ? 'contractor.edited' : 'contractor.created', 'contractor', String(row.id), { after: { name, service } });
    return { ...savedOps(id ? 'Contractor saved.' : 'Contractor added.'), affected: [`/staff/contractors/${String(row.id)}`] };
  });
}

export async function saveBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('contractors.manage', async ({ db, context }) => {
    const contractorId = text(form, 'contractorId');
    if (!contractorId) return fail('Pick a contractor.');
    const role = text(form, 'role') as ContractorService;
    const status = text(form, 'status');
    const agreed = cents(form, 'agreed') ?? 0;
    const deposit = cents(form, 'deposit') ?? 0;
    const paid = cents(form, 'paid') ?? 0;
    const id = optional(form, 'id');
    const { before, after } = await saveBooking(db, id, {
      contractorId,
      eventId: optional(form, 'eventId'),
      locationId: optional(form, 'locationId') ?? context.location.id,
      role: SERVICES.includes(role) ? role : 'other',
      startsAt: optional(form, 'startsAt'),
      endsAt: optional(form, 'endsAt'),
      status: ['tentative', 'confirmed', 'cancelled', 'completed'].includes(status) ? (status as 'tentative' | 'confirmed' | 'cancelled' | 'completed') : 'tentative',
      agreedCents: agreed,
      depositCents: deposit,
      paidCents: paid,
      paymentNote: optional(form, 'paymentNote'),
      paidOn: isoDate(optional(form, 'paidOn')),
      note: optional(form, 'note'),
      arrivalNote: optional(form, 'arrivalNote'),
    }, context.staff);
    await recordOpsAudit(context.staff, id ? 'booking.edited' : 'booking.created', 'contractor_booking', String(after.id), { before, after });
    return savedOps(id ? 'Booking saved.' : 'Booked.', after.event_id ? [`/admin/events/one/${encodeURIComponent(String(after.event_id))}`] : []);
  });
}

/**
 * Gives a contractor a way in.
 *
 * Creates a `contractor` sign-in and links it to their row, which is the
 * only thing that makes /staff/bookings show them anything. It is a
 * deliberately separate action from adding the contractor: most DJs never
 * need a login, and an account nobody asked for is an account nobody
 * closes.
 */
export async function inviteContractor(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('contractors.manage', async ({ db, elevated, context }) => {
    const id = text(form, 'id');
    const contractor = await getContractor(db, id);
    if (!contractor) return fail('That contractor no longer exists.');
    if (!contractor.email) return fail('Add an email address first — it is how they sign in.');
    const { inviteSignIn } = await import('./team');
    const invite = await inviteSignIn(contractor.email, contractor.name, context.staff.name || context.staff.email, 'contractor');
    if (!invite.userId) return fail(invite.note);
    await elevated.update('contractors', id, { user_id: invite.userId });
    await recordOpsAudit(context.staff, 'contractor.invited', 'contractor', id, { after: { email: contractor.email } });
    return savedOps(`${contractor.name} can now see their own bookings, and nothing else. ${invite.note}`);
  });
}

export async function markPaid(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('contractors.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    const { before, after } = await markBookingPaid(db, id, optional(form, 'note'));
    await recordOpsAudit(context.staff, 'booking.paid', 'contractor_booking', id, { before, after });
    return savedOps('Marked paid.');
  });
}
