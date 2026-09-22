'use client';

import { useActionState, useState } from 'react';
import { EMPLOYMENT_LABEL, EMPLOYMENT_TYPES, type JobOpening } from '@/content/careers';
import { archiveOpening, restoreOpening, saveOpening, toggleOpening } from '@/server/actions/hiring';
import type { ActionState } from '@/server/actions/shared';

/**
 * One role, with the switch on the outside and the words on the inside.
 *
 * Switching a role on and off is the thing that happens weekly, so it is one
 * press on the row itself. Editing the title or the sentence underneath is
 * rarer, so it opens.
 */

const IDLE: ActionState = { ok: true, message: '' };

const FIELD =
  'mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown';

export function OpeningEditor({
  opening,
  applicants,
  canArchive,
}: {
  opening: JobOpening;
  applicants: number;
  canArchive: boolean;
}) {
  const [toggleState, toggle, toggling] = useActionState<ActionState, FormData>(toggleOpening, IDLE);
  const [saveState, save, saving] = useActionState<ActionState, FormData>(saveOpening, IDLE);
  const [archiveState, archive, archiving] = useActionState<ActionState, FormData>(
    opening.archivedAt ? restoreOpening : archiveOpening,
    IDLE,
  );
  const [open, setOpen] = useState(false);

  const message = [saveState, toggleState, archiveState].find((state) => state.message);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[1rem] font-semibold text-brown">{opening.title}</span>
            <span className="text-[0.8125rem] text-brown-soft">
              {EMPLOYMENT_LABEL[opening.employmentType]}
            </span>
            {applicants > 0 ? (
              <span className="tabular text-[0.8125rem] text-clay">
                {applicants} {applicants === 1 ? 'applicant' : 'applicants'}
              </span>
            ) : null}
          </p>
          {opening.summary ? (
            <p className="mt-0.5 truncate text-[0.875rem] text-brown-soft">{opening.summary}</p>
          ) : (
            <p className="mt-0.5 text-[0.875rem] text-brown-soft/70">No description yet.</p>
          )}
        </div>

        {!opening.archivedAt ? (
          <form action={toggle}>
            <input type="hidden" name="id" value={opening.id} />
            <input type="hidden" name="active" value={opening.active ? 'false' : 'true'} />
            <button
              type="submit"
              disabled={toggling}
              aria-pressed={opening.active}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.875rem] font-semibold transition-colors disabled:opacity-50 ${
                opening.active
                  ? 'border-success/50 bg-success/10 text-success'
                  : 'border-brown/25 text-brown-soft hover:text-brown'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full ${opening.active ? 'bg-success' : 'bg-brown/30'}`}
              />
              {opening.active ? 'On the website' : 'Off'}
            </button>
          </form>
        ) : (
          <span className="text-[0.8125rem] font-semibold text-brown-soft">Archived</span>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-brown/25 px-3 text-[0.875rem] font-medium text-brown"
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-(--radius-md) border border-brown/15 bg-ivory p-4">
          <form action={save} className="grid gap-4">
            <input type="hidden" name="id" value={opening.id} />
            <input type="hidden" name="active" value={String(opening.active)} />

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
              <div>
                <label htmlFor={`${opening.id}-title`} className="block text-[0.875rem] font-semibold text-brown">
                  Role
                </label>
                <input
                  id={`${opening.id}-title`}
                  name="title"
                  defaultValue={opening.title}
                  maxLength={80}
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor={`${opening.id}-type`} className="block text-[0.875rem] font-semibold text-brown">
                  Hours
                </label>
                <select
                  id={`${opening.id}-type`}
                  name="employmentType"
                  defaultValue={opening.employmentType}
                  className={FIELD}
                >
                  {EMPLOYMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {EMPLOYMENT_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label htmlFor={`${opening.id}-sort`} className="block text-[0.875rem] font-semibold text-brown">
                  Order
                </label>
                <input
                  id={`${opening.id}-sort`}
                  name="sort"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={opening.sort}
                  className={`${FIELD} tabular`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${opening.id}-summary`} className="block text-[0.875rem] font-semibold text-brown">
                One sentence under the title
              </label>
              <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
                Optional. Leave it empty rather than writing something generic — the title on its
                own reads better than a sentence that says nothing.
              </p>
              <textarea
                id={`${opening.id}-summary`}
                name="summary"
                rows={2}
                maxLength={280}
                defaultValue={opening.summary ?? ''}
                placeholder="Nights and weekends, tips pooled, we will train you on the bar."
                className={FIELD}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-coral px-5 font-semibold text-on-orange disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {message?.message ? (
                <p
                  role="status"
                  className={`text-[0.875rem] font-medium ${message.ok ? 'text-success' : 'text-danger'}`}
                >
                  {message.message}
                </p>
              ) : null}
            </div>
          </form>

          {canArchive ? (
            <form action={archive} className="mt-4 border-t border-brown/12 pt-3">
              <input type="hidden" name="id" value={opening.id} />
              <button
                type="submit"
                disabled={archiving}
                className="inline-flex min-h-11 items-center text-[0.875rem] font-semibold text-brown-soft underline underline-offset-4 hover:text-brown disabled:opacity-50"
              >
                {opening.archivedAt ? 'Put it back on the list' : 'Archive this role'}
              </button>
              <p className="mt-1 text-[0.8125rem] text-brown-soft">
                {opening.archivedAt
                  ? 'It comes back switched off.'
                  : 'It leaves the list. Applications for it stay exactly where they are.'}
              </p>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Adding a role people can apply for. Rare enough to be a disclosure. */
export function NewOpening() {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOpening, IDLE);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown hover:bg-brown/6"
      >
        Add a role
      </button>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="sort" value="100" />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="new-title" className="block text-[0.875rem] font-semibold text-brown">
            Role
          </label>
          <input id="new-title" name="title" maxLength={80} required placeholder="Barback" className={FIELD} />
        </div>
        <div>
          <label htmlFor="new-type" className="block text-[0.875rem] font-semibold text-brown">
            Hours
          </label>
          <select id="new-type" name="employmentType" defaultValue="either" className={FIELD}>
            {EMPLOYMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {EMPLOYMENT_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="new-summary" className="block text-[0.875rem] font-semibold text-brown">
          One sentence under the title
        </label>
        <textarea id="new-summary" name="summary" rows={2} maxLength={280} className={FIELD} />
      </div>

      <label className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
        <input type="checkbox" name="active" value="true" className="size-4 accent-[var(--color-coral)]" />
        Put it on the website straight away
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-coral px-5 font-semibold text-on-orange disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add the role'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center text-[0.875rem] font-semibold text-brown-soft underline underline-offset-4"
        >
          Cancel
        </button>
        {state.message ? (
          <p
            role="status"
            className={`text-[0.875rem] font-medium ${state.ok ? 'text-success' : 'text-danger'}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
