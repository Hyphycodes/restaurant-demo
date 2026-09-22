'use client';

import { useActionState } from 'react';
import { unlockTickets, type UnlockState } from '@/server/actions/tickets';

export function UnlockForm({ orderNumber }: { orderNumber: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockTickets, { message: '' });
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <p className="text-[1.125rem] font-semibold text-night-text">Enter the email you paid with to open these tickets.</p>
      <div>
        <label htmlFor="unlock-email" className="block text-[0.875rem] font-semibold text-night-text">Email</label>
        <input
          id="unlock-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1.5 block min-h-12 w-full rounded-(--radius-md) border border-night-text/25 bg-obsidian/40 px-4 text-[1rem] text-night-text focus:border-amber"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-amber px-6 text-[1.0625rem] font-semibold text-on-orange disabled:opacity-50"
      >
        {pending ? 'Checking…' : 'Open my tickets'}
      </button>
      {state.message ? (
        <p role="alert" className="text-[0.9375rem] text-amber">{state.message}</p>
      ) : null}
    </form>
  );
}
