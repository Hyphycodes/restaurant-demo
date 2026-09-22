'use client';

import { useActionState, useState } from 'react';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABEL, type JobApplication } from '@/content/careers';
import { updateApplicant } from '@/server/actions/hiring';
import type { ActionState } from '@/server/actions/shared';

/**
 * One applicant, opened in place.
 *
 * Closed it is a name, a role, when they applied and where they have got to.
 * Open it is everything they sent, their résumé if there was one, and the two
 * controls that matter: where they are up to, and a note for whoever picks
 * this up next.
 *
 * New ones open by default. An application nobody has read is the only thing
 * on this screen that needs attention, so it does not also need a click.
 */

const TONE: Record<string, string> = {
  new: 'border-warning/60 bg-warning/8 text-warning',
  reviewing: 'border-brown/30 bg-brown/6 text-brown',
  contacted: 'border-brown/30 bg-brown/6 text-brown',
  interview: 'border-clay/45 bg-clay/8 text-clay',
  hired: 'border-success/50 bg-success/10 text-success',
  passed: 'border-brown/25 text-brown-soft',
  archived: 'border-brown/25 text-brown-soft',
};

function when(iso: string): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(Date.parse(iso));
}

export function ApplicantRow({ application }: { application: JobApplication }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateApplicant, {
    ok: true,
    message: '',
  });
  const [open, setOpen] = useState(application.status === 'new');

  const facts: [string, string | null][] = [
    ['Available', application.availability],
    ['Experience', application.experience],
    ['Anything else', application.notes],
  ];

  return (
    <li className="border-b border-brown/12 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold text-brown">
            {application.name}
            <span className="ml-2 text-[0.8125rem] font-normal text-brown-soft">
              {application.position}
            </span>
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
            <a href={`mailto:${application.email}`} className="underline underline-offset-4">
              {application.email}
            </a>
            {application.phone ? (
              <>
                {' · '}
                <a
                  href={`tel:+1${application.phone.replace(/\D/g, '')}`}
                  className="tabular underline underline-offset-4"
                >
                  {application.phone}
                </a>
              </>
            ) : null}
            {' · '}
            {when(application.createdAt)}
          </p>
        </div>

        <p
          className={`shrink-0 rounded-(--radius-sm) border px-2 py-1 text-[0.75rem] font-semibold ${
            TONE[application.status] ?? TONE.reviewing
          }`}
        >
          {APPLICATION_STATUS_LABEL[application.status]}
        </p>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex min-h-11 shrink-0 items-center rounded-(--radius-md) border border-brown/25 px-3 text-[0.875rem] font-medium text-brown"
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>

      {open ? (
        <div className="mt-4 rounded-(--radius-md) border border-brown/15 bg-ivory p-4">
          <dl className="grid gap-3">
            {facts
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                    {label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">
                    {value}
                  </dd>
                </div>
              ))}
          </dl>

          <p className="mt-4 text-[0.875rem]">
            {application.resumePath ? (
              <a
                href={`/admin/files/${application.resumePath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-clay underline underline-offset-4"
              >
                Open résumé
                <span className="font-normal text-brown-soft">
                  {application.resumeName ? `(${application.resumeName})` : ''}
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="text-brown-soft">No résumé attached.</span>
            )}
          </p>

          <form action={action} className="mt-5 grid gap-4 border-t border-brown/15 pt-4">
            <input type="hidden" name="id" value={application.id} />

            <div className="sm:max-w-xs">
              <label
                htmlFor={`${application.id}-status`}
                className="block text-[0.875rem] font-semibold text-brown"
              >
                Where are they up to?
              </label>
              {/* Keyed on the stored value so the control cannot keep showing
                  a status the row no longer has. */}
              <select
                key={application.status}
                id={`${application.id}-status`}
                name="status"
                defaultValue={application.status}
                className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown"
              >
                {APPLICATION_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {APPLICATION_STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`${application.id}-notes`}
                className="block text-[0.875rem] font-semibold text-brown"
              >
                Internal notes
              </label>
              <textarea
                id={`${application.id}-notes`}
                name="staffNotes"
                rows={2}
                defaultValue={application.staffNotes ?? ''}
                placeholder="Only your team sees this."
                className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-coral px-5 font-semibold text-on-orange disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
              {state.message ? (
                <p
                  role="status"
                  className={`text-[0.875rem] font-medium ${state.ok ? 'text-success' : 'text-danger'}`}
                >
                  {state.message}
                </p>
              ) : null}
              <p className="tabular text-[0.8125rem] text-brown-soft">{application.reference}</p>
            </div>
          </form>
        </div>
      ) : null}
    </li>
  );
}
