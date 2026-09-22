'use client';

import { SelectField, TextArea, TextField } from './Field';
import { FormShell } from './FormShell';
import { useInquiry } from './useInquiry';

export function CateringForm({
  phone,
  packageNames,
}: {
  phone: string;
  packageNames: string[];
}) {
  const form = useInquiry('catering');

  return (
    <FormShell
      submitLabel="Send catering enquiry"
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
        <TextField
          name="organization"
          label="Company or organization"
          autoComplete="organization"
          error={form.errors.organization}
        />
        <TextField name="email" label="Email" type="email" required autoComplete="email" error={form.errors.email} />
        <TextField name="phone" label="Phone" type="tel" required autoComplete="tel" error={form.errors.phone} />
        <TextField name="date" label="Date needed" type="date" required error={form.errors.date} />
        <TextField name="time" label="Time needed" placeholder="e.g. 12:30pm" error={form.errors.time} />
        <TextField
          name="guests"
          label="Guest count"
          type="number"
          min={1}
          max={1000}
          required
          error={form.errors.guests}
        />
        <SelectField
          name="fulfillment"
          label="Pickup or delivery"
          required
          hint="Delivery is not confirmed yet — we will tell you what is possible."
          error={form.errors.fulfillment}
          options={[
            { value: 'pickup', label: 'Pickup' },
            { value: 'delivery', label: 'Delivery, if possible' },
            { value: 'not-sure', label: 'Not sure yet' },
          ]}
        />
      </div>

      <SelectField
        name="packageInterest"
        label="Package you are interested in"
        error={form.errors.packageInterest}
        options={[
          ...packageNames.map((name) => ({ value: name, label: name })),
          { value: 'By the tray', label: 'Individual trays' },
          { value: 'Not sure', label: 'Not sure — help me choose' },
        ]}
      />

      <TextArea
        name="notes"
        label="Anything else"
        placeholder="Dietary needs, setup, drop-off details…"
        error={form.errors.notes}
      />
    </FormShell>
  );
}
