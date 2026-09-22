'use client';

import { useState } from 'react';

/** "Email these to me again", from the tickets page. */
export function ResendButton({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ kind: 'idle' });

  async function send() {
    if (state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/resend`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setState({ kind: response.ok && data?.ok ? 'done' : 'error', message: data?.message ?? 'Could not send just now.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach us. Check your connection.' });
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={send}
        disabled={state.kind === 'busy' || state.kind === 'done'}
        className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-amber underline underline-offset-4 disabled:no-underline disabled:opacity-70"
      >
        {state.kind === 'busy' ? 'Sending…' : state.kind === 'done' ? state.message : 'Email these to me again'}
      </button>
      {state.kind === 'error' ? <p role="alert" className="mt-1 text-[0.875rem] text-night-soft">{state.message}</p> : null}
    </div>
  );
}
