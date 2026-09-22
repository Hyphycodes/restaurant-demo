'use client';

import type { EmployeeSummary, EventBrief } from '@/content/staff-types';
import { clockFromMinutes, zonedMinutes } from '@/lib/staff/time';
import { saveEventBrief } from '@/server/actions/staff/briefs';
import { ActionForm, Field, Select, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';

/**
 * What the floor is told about a night.
 *
 * Five fields, because five is what actually gets filled in before service.
 * Everything here is visible to every employee working — the form says so,
 * so nobody writes the payout in the notes.
 */
export function BriefForm({ eventId, brief, timezone, managers }: { eventId: string; brief: EventBrief | null; timezone: string; managers: EmployeeSummary[] }) {
  return (
    <ActionForm action={saveEventBrief} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Field id="callTime" label="Be in by" hint="What time staff should be here.">
        <TextInput id="callTime" name="callTime" type="time" defaultValue={brief?.callTimeAt ? clockFromMinutes(zonedMinutes(brief.callTimeAt, timezone)) : ''} />
      </Field>
      <Field id="expectedGuests" label="Expected guests" hint="Leave blank to show the ticket count instead.">
        <TextInput id="expectedGuests" name="expectedGuests" type="number" min={0} inputMode="numeric" defaultValue={brief?.expectedGuests ?? ''} />
      </Field>
      <Field id="dressCode" label="Dress">
        <TextInput id="dressCode" name="dressCode" maxLength={120} defaultValue={brief?.dressCode ?? ''} placeholder="All black, closed-toe shoes" />
      </Field>
      <Field id="managerEmployeeId" label="Manager on the night">
        <Select id="managerEmployeeId" name="managerEmployeeId" defaultValue={brief?.managerEmployeeId ?? ''}>
          <option value="">Not decided</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.displayName}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="staffNotes" label="Notes for the floor" hint="Every employee working that night reads this. Keep money and contracts out of it.">
          <TextArea id="staffNotes" name="staffNotes" rows={3} maxLength={600} defaultValue={brief?.staffNotes ?? ''} placeholder="ID checks required. Bar runs two wells; the second opens at doors." />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Save brief</SubmitButton>
      </div>
    </ActionForm>
  );
}
