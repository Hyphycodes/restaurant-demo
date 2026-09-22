'use client';

import { SelectField, TextArea, TextField } from './Field';
import { FormShell } from './FormShell';
import { useInquiry } from './useInquiry';

export function CareersForm({ phone, positions }: { phone: string; positions: readonly string[] }) {
  const form = useInquiry('careers');

  return (
    <FormShell
      submitLabel="Send application"
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
        <TextField name="name" label="Full name" required autoComplete="name" error={form.errors.name} />
        <SelectField
          name="position"
          label="Position"
          required
          error={form.errors.position}
          options={positions.map((p) => ({ value: p, label: p }))}
        />
        <TextField name="email" label="Email" type="email" required autoComplete="email" error={form.errors.email} />
        <TextField name="phone" label="Phone" type="tel" required autoComplete="tel" error={form.errors.phone} />
      </div>

      <TextArea
        name="availability"
        label="Weekly availability"
        required
        placeholder="List the days and times you can work"
        error={form.errors.availability}
      />
      <TextArea
        name="notes"
        label="About you"
        placeholder="A short note about yourself and your experience"
        error={form.errors.notes}
      />
    </FormShell>
  );
}
