'use client';

import { useState } from 'react';

/**
 * A disputed charge, packaged for Stripe's form.
 *
 * Stripe's dispute form wants evidence, and the single most persuasive thing a
 * venue has is a timestamped check-in: this person walked in. Assembling that
 * by hand at 11pm is how disputes get lost by default, so it is one tap.
 */
export function DisputeEvidence({ orderNumber }: { orderNumber: string }) {
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');

  async function load() {
    setState('busy');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/evidence`);
      const data = (await response.json()) as { evidence?: string };
      if (!response.ok || !data.evidence) throw new Error('no evidence');
      setText(data.evidence);
      try {
        await navigator.clipboard.writeText(data.evidence);
        setState('copied');
      } catch {
        setState('idle');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void load()}
        disabled={state === 'busy'}
        className="min-h-11 text-[0.875rem] font-semibold text-clay underline underline-offset-4 disabled:opacity-60"
      >
        {state === 'busy' ? 'Gathering…' : state === 'copied' ? 'Copied — paste into Stripe' : `Evidence for ${orderNumber}`}
      </button>
      {state === 'error' ? <p className="mt-1 text-[0.8125rem] text-danger">Could not gather it. Try again.</p> : null}
      {text ? (
        <textarea
          readOnly
          value={text}
          rows={10}
          className="mt-2 w-full rounded-(--radius-sm) border border-brown/25 bg-linen p-3 font-mono text-[0.75rem] leading-relaxed text-brown"
        />
      ) : null}
    </div>
  );
}
