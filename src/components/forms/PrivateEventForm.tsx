'use client';

import { CheckboxField, SelectField, TextArea, TextField } from './Field';
import { FormShell } from './FormShell';
import { useInquiry } from './useInquiry';

export function PrivateEventForm({
  phone,
  eventTypes,
}: {
  phone: string;
  eventTypes: readonly string[];
}) {
  const form = useInquiry('private-event');

  return (
    <FormShell
      submitLabel="Send event enquiry"
      phone={phone}
      pending={form.pending}
      result={form.result}
      formError={form.formError}
      errorCount={Object.keys(form.errors).length}
      formRef={form.formRef}
      statusId={form.statusId}
      onSubmit={form.onSubmit}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Your name" required autoComplete="name" error={form.errors.name} />
        <SelectField
          name="eventType"
          label="Type of event"
          required
          error={form.errors.eventType}
          options={eventTypes.map((t) => ({ value: t, label: t }))}
        />
        <TextField name="email" label="Email" type="email" required autoComplete="email" error={form.errors.email} />
        <TextField name="phone" label="Phone" type="tel" required autoComplete="tel" error={form.errors.phone} />
        <TextField name="date" label="Preferred date" type="date" required error={form.errors.date} />
        <TextField
          name="guests"
          label="Estimated guests"
          type="number"
          min={1}
          max={1000}
          required
          error={form.errors.guests}
        />
        <SelectField
          name="contactPreference"
          label="Best way to reach you"
          required
          error={form.errors.contactPreference}
          options={[
            { value: 'phone', label: 'Phone call' },
            { value: 'text', label: 'Text message' },
            { value: 'email', label: 'Email' },
          ]}
        />
        <div className="flex items-end pb-1">
          <CheckboxField name="dateFlexible" label="My date is flexible" />
        </div>
      </div>

      <TextArea
        name="notes"
        label="Tell us about it"
        placeholder="Occasion, timing, food and drink ideas…"
        error={form.errors.notes}
      />
    </FormShell>
  );
}
