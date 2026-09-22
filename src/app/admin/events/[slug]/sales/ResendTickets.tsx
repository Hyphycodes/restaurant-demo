'use client';

import { useState } from 'react';

/** "Send the tickets again", from the order row. Staff session is the auth. */
export function ResendTickets({ orderNumber, email }: { orderNumber: string; email: string | null }) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ kind: 'idle' });
  if (!email) return null;
  async function send() {
    setState({ kind: 'busy' });
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/resend`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setState({ kind: response.ok && data?.ok ? 'done' : 'error', message: data?.message ?? 'Could not send.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the mailer.' });
    }
  }
  if (state.kind === 'done' || state.kind === 'error') {
    return <span className={`text-[0.8125rem] ${state.kind === 'done' ? 'text-success' : 'text-danger'}`}>{state.message}</span>;
  }
  return (
    <button type="button" onClick={send} disabled={state.kind === 'busy'} className="inline-flex min-h-10 items-center text-[0.875rem] text-brown-soft underline underline-offset-4 hover:text-brown disabled:opacity-60">
      {state.kind === 'busy' ? 'Sending…' : 'Resend tickets'}
    </button>
  );
}
