'use client';

import { submitTalent } from '@/app/actions/apply';
import { TALENT_DISCIPLINES } from '@/content/talent';
import { TALENT_MEDIA_HINT, TALENT_MEDIA_MAX_BYTES, TALENT_MEDIA_MAX_FILES } from '@/lib/submissions';
import { SelectField, TextArea, TextField } from './Field';
import { FileField } from './FileField';
import { FormShell } from './FormShell';
import { useSubmission } from './useSubmission';

/**
 * "Here is what I do."
 *
 * Four things above the fold — your name, what you do, a sentence about it,
 * and one way to reach you — and everything else folded away behind a
 * disclosure. A DJ sends this from a phone at one in the morning; it has to
 * be finishable in about a minute or it is not going to be finished.
 *
 * Email OR phone, not both: somebody who lives on Instagram and gives a
 * number has told us enough to call them.
 */
export function TalentForm({ phone }: { phone: string }) {
  const form = useSubmission(submitTalent);

  return (
    <FormShell
      submitLabel="Send it over"
      phone={phone}
      pending={form.pending}
      result={form.result}
      formError={form.formError}
      errorCount={Object.keys(form.errors).length}
      formRef={form.formRef}
      statusId={form.statusId}
      onSubmit={form.onSubmit}
      encType="multipart/form-data"
      privacyNote="This goes to the Casa Aurelia team. We never publish anything you send without asking you first."
      success={{
        title: 'We got it.',
        body: (
          <p>
            We will have a proper look at your work and reach out if something feels like a fit.
            {form.result?.ok && 'emailed' in form.result && form.result.emailed
              ? ' There is a copy in your inbox.'
              : ''}{' '}
            No news does not mean no — we keep everybody on this list, and nights come up.
          </p>
        ),
      }}
    >
      <TextField name="name" label="Your name" required autoComplete="name" error={form.errors.name} />

      <SelectField
        name="discipline"
        label="What do you do?"
        required
        error={form.errors.discipline}
        placeholder="Pick the closest one"
        options={TALENT_DISCIPLINES.map((entry) => ({ value: entry.id, label: entry.label }))}
      />

      <TextArea
        name="pitch"
        label="Tell us in a sentence"
        required
        rows={3}
        placeholder="Soul, disco, Italian classics and tasteful house."
        error={form.errors.pitch}
      />

      <TextArea
        name="links"
        label="Links"
        rows={3}
        hint="Instagram, TikTok, a mix, a portfolio — paste as many as you like, one per line."
        placeholder={'instagram.com/yourname\nsoundcloud.com/yourname'}
        error={form.errors.links}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Either this or an email."
          error={form.errors.phone}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          error={form.errors.email}
        />
      </div>

      {/* Folded away on purpose: three more boxes on first sight is what makes
          a one-minute form feel like a ten-minute one. */}
      <details className="group rounded-(--radius-md) border border-brown/20 bg-linen/50">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.9375rem] font-semibold text-brown [&::-webkit-details-marker]:hidden">
          Want to add photos or an idea?
          <span
            aria-hidden="true"
            className="text-clay transition-transform duration-200 group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="grid gap-5 border-t border-brown/12 px-4 py-5">
          <FileField
            name="media"
            label="Photos of your work"
            hint={TALENT_MEDIA_HINT}
            accept="image/*"
            multiple
            maxFiles={TALENT_MEDIA_MAX_FILES}
            maxBytes={TALENT_MEDIA_MAX_BYTES}
          />
          <TextArea
            name="idea"
            label="What would you want to do at Casa Aurelia?"
            rows={3}
            placeholder="A Thursday residency, a mural on the patio wall, a listening night for Día de Muertos…"
            error={form.errors.idea}
          />
          <TextArea
            name="notes"
            label="Anything else"
            rows={2}
            error={form.errors.notes}
          />
        </div>
      </details>
    </FormShell>
  );
}
