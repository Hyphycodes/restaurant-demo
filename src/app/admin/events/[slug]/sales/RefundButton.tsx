'use client';
import { DEMO_MODE } from '@/lib/demo';

import { useActionState, useState } from 'react';
import { refundOrder, type RefundState } from '@/server/actions/sales';

export function RefundButton({ orderId, amount }: { orderId: string; amount: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<RefundState, FormData>(refundOrder, { ok: true, message: '' });
  if (state.message) {
    return <span className={`text-[0.8125rem] ${state.ok ? 'text-success' : 'text-danger'}`}>{state.message}</span>;
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-10 items-center text-[0.875rem] text-brown-soft underline underline-offset-4 hover:text-brown">
        Refund
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={DEMO_MODE || pending} className="inline-flex min-h-10 items-center rounded-(--radius-sm) bg-coral px-3 text-[0.875rem] font-semibold text-on-orange disabled:opacity-60">
        {pending ? 'Refunding…' : `Refund ${amount}`}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-10 items-center text-[0.875rem] text-brown-soft underline underline-offset-4">
        Keep it
      </button>
    </form>
  );
}
