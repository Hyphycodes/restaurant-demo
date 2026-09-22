'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/content/admin-types';
import type { AttentionFix } from '@/server/content/attention';
import { setOccurrencePublished } from '@/server/actions/events';
import { publishRow, setAvailability } from '@/server/actions/menu';

/** One tap. The row says what happened and stays put. */
export function TidyFix({ fix, label }: { fix: AttentionFix; label: string }) {
  const action = fix.kind === 'unpublish-occurrence' ? setOccurrencePublished : fix.kind === 'menu-available' ? setAvailability : publishRow;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { ok: true, message: '' });
  if (state.ok && state.message) {
    return <span className="text-[0.875rem] text-success">Done.</span>;
  }
  return (
    <form action={formAction} className="flex items-center gap-3">
      {fix.kind === 'unpublish-occurrence' ? (
        <>
          <input type="hidden" name="id" value={fix.id} />
          <input type="hidden" name="published" value="false" />
        </>
      ) : fix.kind === 'menu-available' ? (
        <>
          <input type="hidden" name="id" value={fix.id} />
          <input type="hidden" name="availability" value="available" />
          <input type="hidden" name="note" value="" />
        </>
      ) : (
        <>
          <input type="hidden" name="table" value={fix.table} />
          <input type="hidden" name="id" value={fix.id} />
        </>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-(--radius-sm) border border-brown/25 px-3 text-[0.875rem] font-semibold text-brown hover:border-brown/45 disabled:opacity-60"
      >
        {pending ? 'One moment…' : label}
      </button>
      {!state.ok && state.message ? <span className="text-[0.8125rem] text-danger">{state.message}</span> : null}
    </form>
  );
}
