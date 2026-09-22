'use client';

import type { ShiftView } from '@/content/staff-types';
import { ATTENDANCE_LABEL } from '@/content/staff-types';
import { saveAttendance } from '@/server/actions/staff/schedule';
import { ActionForm, Field, Select, SubmitButton, TextInput } from '@/components/staff/forms';

function local(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : '';
}

/** A manager correcting the clock: what actually happened, in their words. Stored as instants. */
export function AttendanceForm({ shift }: { shift: ShiftView }) {
  return (
    <ActionForm action={saveAttendance} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={shift.id} />
      <Field id="attendanceStatus" label="Attendance">
        <Select id="attendanceStatus" name="attendanceStatus" defaultValue={shift.attendanceStatus}>
          {(Object.keys(ATTENDANCE_LABEL) as (keyof typeof ATTENDANCE_LABEL)[]).map((status) => (
            <option key={status} value={status}>
              {ATTENDANCE_LABEL[status]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="breakMinutes" label="Break (minutes)">
        <TextInput id="breakMinutes" name="breakMinutes" type="number" min={0} defaultValue={shift.breakMinutes} inputMode="numeric" />
      </Field>
      <Field id="clockInAt" label="Clock in (UTC)" hint="Leave blank if untracked.">
        <TextInput id="clockInAt" name="clockInAt" type="datetime-local" defaultValue={local(shift.clockInAt)} />
      </Field>
      <Field id="clockOutAt" label="Clock out (UTC)">
        <TextInput id="clockOutAt" name="clockOutAt" type="datetime-local" defaultValue={local(shift.clockOutAt)} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="note" label="Note" hint="Why it was corrected. Kept with the shift.">
          <TextInput id="note" name="note" defaultValue={shift.attendanceNote ?? ''} maxLength={300} />
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary">Save attendance</SubmitButton>
      </div>
    </ActionForm>
  );
}
