'use client';

import type { EmployeeSummary, LocationSummary, Position, ShiftView } from '@/content/staff-types';
import { clockFromMinutes, zonedDate, zonedMinutes } from '@/lib/staff/time';
import { cancelShift, saveShift } from '@/server/actions/staff/schedule';
import { CloseOnSave } from '@/components/staff/Drawer';
import { ActionForm, Field, OneTap, Select, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';

export interface EventOption {
  id: string;
  label: string;
}

/**
 * One shift, created or changed.
 *
 * Ordered the way a manager says it out loud — who, doing what, when — and
 * the two things that are decisions rather than facts (publish now, repeat
 * weekly) sit at the bottom under their own heading so nobody publishes a
 * week by accident while filling in a Tuesday.
 *
 * `closeHref` is set when it is living in the drawer over the week: the form
 * then takes itself away once it has saved, instead of leaving you looking
 * at the thing you just finished.
 */
export function ShiftForm({
  shift,
  date,
  employees,
  positions,
  locations,
  events,
  defaultLocationId,
  defaultEmployeeId,
  defaultPositionId,
  closeHref,
}: {
  shift: ShiftView | null;
  date: string;
  employees: EmployeeSummary[];
  positions: Position[];
  locations: LocationSummary[];
  events: EventOption[];
  defaultLocationId: string;
  defaultEmployeeId?: string | null;
  defaultPositionId?: string | null;
  closeHref?: string;
}) {
  const timezone = shift?.locationTimezone ?? locations.find((location) => location.id === defaultLocationId)?.timezone ?? 'America/Chicago';
  const employeeId = shift?.employeeId ?? defaultEmployeeId ?? '';
  const chosen = employees.find((employee) => employee.id === employeeId);
  // When a person is already chosen, put the positions they actually work
  // first — a bartender being put on the door is possible but rarely meant.
  const ordered = chosen ? [...positions].sort((a, b) => Number(chosen.positionIds.includes(b.id)) - Number(chosen.positionIds.includes(a.id))) : positions;
  const startPosition = shift?.positionId ?? defaultPositionId ?? chosen?.positionIds[0] ?? ordered[0]?.id ?? '';
  const eligible = (position: string) => employees.filter((employee) => employee.positionIds.includes(position)).length;

  return (
    <div className="grid gap-6">
      <ActionForm action={saveShift} className="grid gap-4 sm:grid-cols-2" onDone={closeHref ? () => <CloseOnSave href={closeHref} /> : undefined}>
        {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
        <Field id="employeeId" label="Who" hint="Leave open and anyone eligible can pick it up.">
          <Select id="employeeId" name="employeeId" defaultValue={employeeId}>
            <option value="">Open shift</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.displayName}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="positionId" label="Position">
          <Select id="positionId" name="positionId" defaultValue={startPosition} required>
            {ordered.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
                {eligible(position.id) ? ` (${eligible(position.id)})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="date" label="Date">
          <TextInput id="date" name="date" type="date" defaultValue={shift ? zonedDate(shift.startsAt, timezone) : date} required />
        </Field>
        <Field id="locationId" label="Location">
          <Select id="locationId" name="locationId" defaultValue={shift?.locationId ?? defaultLocationId} required>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="startTime" label="Start">
          <TextInput id="startTime" name="startTime" type="time" defaultValue={shift ? clockFromMinutes(zonedMinutes(shift.startsAt, timezone)) : '17:00'} required />
        </Field>
        <Field id="endTime" label="End" hint="An end at or before the start means the next morning.">
          <TextInput id="endTime" name="endTime" type="time" defaultValue={shift ? clockFromMinutes(zonedMinutes(shift.endsAt, timezone)) : '01:00'} required />
        </Field>
        <div className="sm:col-span-2">
          <Field id="note" label="Note for the employee" hint="Optional. They read this on their shift.">
            <TextArea id="note" name="note" rows={2} maxLength={300} defaultValue={shift?.note ?? ''} />
          </Field>
        </div>
        <Field id="eventId" label="Part of an event" hint="Optional.">
          <Select id="eventId" name="eventId" defaultValue={shift?.eventId ?? ''}>
            <option value="">No event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </Select>
        </Field>
        {!shift ? (
          <Field id="repeatWeeks" label="Repeat weekly" hint="How many more weeks. 0 is just this one.">
            <TextInput id="repeatWeeks" name="repeatWeeks" type="number" min={0} max={26} defaultValue={0} inputMode="numeric" />
          </Field>
        ) : (
          <Field id="status" label="Visible to the employee">
            <Select id="status" name="status" defaultValue={shift.status === 'published' ? 'published' : 'draft'}>
              <option value="draft">Draft — only managers see it</option>
              <option value="published">Published — tells the employee</option>
            </Select>
          </Field>
        )}
        {!shift ? (
          <Field id="status" label="Visible to the employee" hint="Drafts wait for the week to be published.">
            <Select id="status" name="status" defaultValue="draft">
              <option value="draft">Draft — only managers see it</option>
              <option value="published">Publish now — tells the employee</option>
            </Select>
          </Field>
        ) : null}
        <div className="flex items-end sm:col-span-2">
          <SubmitButton>{shift ? 'Save shift' : 'Add shift'}</SubmitButton>
        </div>
      </ActionForm>
      {shift && shift.status !== 'cancelled' ? (
        <div className="border-t border-brown/12 pt-4">
          <OneTap action={cancelShift} fields={{ id: shift.id }} variant="danger" confirm="Cancel this shift? If it was published, the employee is told.">
            Cancel shift
          </OneTap>
        </div>
      ) : null}
    </div>
  );
}
