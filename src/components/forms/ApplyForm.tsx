'use client';

import { submitApplication } from '@/app/actions/apply';
import { employmentLabel, type JobOpening } from '@/content/careers';
import { OPEN_APPLICATION_ID, RESUME_HINT, RESUME_MAX_BYTES } from '@/lib/submissions';
import { SelectField, TextArea, TextField } from './Field';
import { FileField } from './FileField';
import { FormShell } from './FormShell';
import { useSubmission } from './useSubmission';


export function ApplyForm({
  phone,
  openings,
  defaultOpeningId,
}: {
  phone: string;
  openings: JobOpening[];
  /** Preselected when somebody pressed Apply on a particular opening. */
  defaultOpeningId?: string;
}) {
  const form = useSubmission(submitApplication);

  const options = [
    ...openings.map((opening) => ({
      value: opening.id,
      label: `${opening.title} · ${employmentLabel(opening.employmentType)}`,
    })),
    { value: OPEN_APPLICATION_ID, label: 'Something else — I will explain below' },
  ];
  const preselected =
    defaultOpeningId && options.some((option) => option.value === defaultOpeningId)
      ? defaultOpeningId
      : openings.length === 0
        ? OPEN_APPLICATION_ID
        : undefined;

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
      encType="multipart/form-data"
      privacyNote="Your application is read by the Casa Aurelia team and nobody else."
      success={{
        title: 'Got it — thanks for putting your name in.',
        body: (
          <p>
            Somebody at Casa Aurelia reads every one of these.
            {form.result?.ok && 'emailed' in form.result && form.result.emailed
              ? ' A copy is on its way to your inbox.'
              : ''}{' '}
            If you want to follow up sooner, call us at{' '}
            <a
              href={`tel:+1${phone.replace(/\D/g, '')}`}
              className="tabular text-brown underline underline-offset-4"
            >
              {phone}
            </a>
            .
          </p>
        ),
      }}
    >
      {openings.length > 0 ? (
        // `key` matters: pressing Apply on a different role is a soft
        // navigation, and React reuses the same <select> element — a changed
        // `defaultValue` would be ignored and the role would silently reset
        // to "Choose one". Remounting is what makes the preselection real.
        <SelectField
          key={preselected ?? 'unchosen'}
          name="openingId"
          label="What are you applying for?"
          required
          error={form.errors.openingId}
          options={options}
          defaultValue={preselected}
        />
      ) : (
        <input type="hidden" name="openingId" value={OPEN_APPLICATION_ID} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Your name" required autoComplete="name" error={form.errors.name} />
        <TextField
          name="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          error={form.errors.phone}
        />
      </div>

      <TextField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        required
        autoComplete="email"
        error={form.errors.email}
      />

      <TextArea
        name="availability"
        label="When can you work?"
        required
        rows={3}
        placeholder="Weeknights after 5, all day Saturday — whatever is true."
        error={form.errors.availability}
      />

      <TextArea
        name="experience"
        label="Done this before?"
        rows={3}
        placeholder="Where you have worked, or nothing at all — we train."
        error={form.errors.experience}
      />

      <FileField
        name="resume"
        label="Résumé"
        hint={RESUME_HINT}
        accept=".pdf,.doc,.docx,image/*"
        maxBytes={RESUME_MAX_BYTES}
      />

      <TextArea
        name="notes"
        label="Anything else"
        rows={2}
        placeholder="Anything you want us to know."
        error={form.errors.notes}
      />
    </FormShell>
  );
}
