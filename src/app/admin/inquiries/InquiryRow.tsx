'use client';

import { useActionState, useState } from 'react';
import type { InquiryRecord } from '@/content/types';
import { updateInquiry } from '@/server/actions/inquiries';
import type { ActionState } from '@/server/actions/shared';

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  'in-progress': 'Working on it',
  closed: 'Done',
};

const TYPE_LABEL: Record<string, string> = {
  catering: 'Catering',
  'private-event': 'Private event',
  careers: 'Job application',
};

export function InquiryRow({ inquiry }: { inquiry: InquiryRecord }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateInquiry, { ok: true, message: '' });
  const [open, setOpen] = useState(inquiry.status === 'new');

  return (
    <li className="border-b border-brown/12 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-brown">
            {inquiry.name}
            <span className="ml-2 text-[0.8125rem] font-normal text-brown-soft">
              {TYPE_LABEL[inquiry.type]}
            </span>
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
            <a href={`mailto:${inquiry.email}`} className="underline underline-offset-4">
              {inquiry.email}
            </a>
            {inquiry.phone ? (
              <>
                {' · '}
                <a
                  href={`tel:+1${inquiry.phone.replace(/\D/g, '')}`}
                  className="tabular underline underline-offset-4"
                >
                  {inquiry.phone}
                </a>
              </>
            ) : null}
          </p>
        </div>

        <p
          className={`shrink-0 rounded-(--radius-sm) border px-2 py-1 text-[0.75rem] font-semibold ${
            inquiry.status === 'new'
              ? 'border-warning text-warning'
              : inquiry.status === 'closed'
                ? 'border-brown/25 text-brown-soft'
                : 'border-success text-success'
          }`}
        >
          {STATUS_LABEL[inquiry.status]}
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
          <dl className="grid gap-x-6 gap-y-2 text-[0.875rem] sm:grid-cols-2">
            {Object.entries(inquiry.payload).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0 capitalize text-brown-soft">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </dt>
                <dd className="min-w-0 text-brown">{String(value)}</dd>
              </div>
            ))}
          </dl>

          <form action={action} className="mt-5 grid gap-4 border-t border-brown/15 pt-4">
            <input type="hidden" name="id" value={inquiry.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${inquiry.id}-status`} className="block text-[0.875rem] font-semibold text-brown">
                  Status
                </label>
                <select
                  id={`${inquiry.id}-status`}
                  name="status"
                  defaultValue={inquiry.status}
                  className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown"
                >
                  <option value="new">New</option>
                  <option value="in-progress">Working on it</option>
                  <option value="closed">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`${inquiry.id}-notes`} className="block text-[0.875rem] font-semibold text-brown">
                Internal notes
              </label>
              <textarea
                id={`${inquiry.id}-notes`}
                name="notes"
                rows={2}
                defaultValue={inquiry.notes ?? ''}
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
              <p className="tabular text-[0.8125rem] text-brown-soft">
                Ref {inquiry.id.slice(0, 8)}
              </p>
            </div>
          </form>
        </div>
      ) : null}
    </li>
  );
}
