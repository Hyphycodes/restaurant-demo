'use server';

import { minutesFromClock, zonedInstant } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { saveBrief } from '@/server/staff/briefs';
import { getEventLite } from '@/server/staff/events';
import { locationMap, resolveLocation } from '@/server/staff/locations';
import { fail, integer, optional, runOps, savedOps, text, type ActionState } from './shared';

/**
 * The night brief a manager writes and the floor reads.
 *
 * Gated on `events.staff` rather than `events.view_brief`: everybody working
 * that night reads it, one person writes it.
 */
export async function saveEventBrief(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('events.staff', async ({ db, context }) => {
    const eventId = text(form, 'eventId');
    if (!eventId) return fail('Which event?');
    const event = await getEventLite(db, eventId);
    if (!event) return fail('That event no longer exists.');
    const timezone = resolveLocation(await locationMap(db), event.locationId ?? context.location.id).timezone;
    // Call time is typed as a clock, on the event's own day, in its own zone.
    const clock = optional(form, 'callTime');
    const minutes = clock ? minutesFromClock(clock) : null;
    const callTimeAt = minutes === null ? null : zonedInstant(event.startsAt.slice(0, 10), minutes, timezone);
    const brief = await saveBrief(
      db,
      eventId,
      {
        callTimeAt,
        dressCode: optional(form, 'dressCode'),
        expectedGuests: integer(form, 'expectedGuests'),
        managerEmployeeId: optional(form, 'managerEmployeeId'),
        staffNotes: optional(form, 'staffNotes'),
      },
      context.staff,
    );
    await recordOpsAudit(context.staff, 'event_brief.saved', 'event', eventId, { after: brief as never });
    return savedOps('Brief saved. Everyone working that night sees it.');
  });
}
