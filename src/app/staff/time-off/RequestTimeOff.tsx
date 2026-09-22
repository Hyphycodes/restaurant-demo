'use client';

import { submitTimeOff } from '@/server/actions/staff/timeoff';
import { ActionForm, Field, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';

/**
 * The request form.
 *
 * A client component rather than JSX inside the page, because it reads the
 * action's result to put an error next to the field it belongs to — and a
 * function child cannot cross the server/client boundary.
 */
export function RequestTimeOff({ today }: { today: string }) {
  return (
    <ActionForm action={submitTimeOff} className="grid gap-4 sm:grid-cols-2">
      {(state) => (
        <>
          <Field id="startsOn" label="First day" error={state.errors?.startsOn}>
            <TextInput id="startsOn" name="startsOn" type="date" min={today} required />
          </Field>
          <Field id="endsOn" label="Last day" hint="Same as the first for one day." error={state.errors?.endsOn}>
            <TextInput id="endsOn" name="endsOn" type="date" min={today} />
          </Field>
          <Field id="reason" label="Reason" hint="Optional.">
            <TextInput id="reason" name="reason" maxLength={120} placeholder="Wedding, travel, appointment…" />
          </Field>
          <Field id="note" label="Anything else" hint="Optional.">
            <TextArea id="note" name="note" rows={2} maxLength={500} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Send request</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
