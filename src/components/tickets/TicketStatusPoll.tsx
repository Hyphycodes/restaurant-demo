'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Waiting for the webhook, calmly.
 *
 * Polls the order's status every 1.5 seconds for up to 20 seconds. Webhooks
 * are usually instant, not guaranteed; a successful charge must never be met
 * with an error, so after the window the page says the tickets are on their
 * way by email and stops.
 */
export function TicketStatusPoll({ orderNumber, token }: { orderNumber: string; token: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let stopped = false;
    const id = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/status?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => null)) as { paid?: boolean; status?: string } | null;
        if (data?.paid || data?.status === 'failed' || data?.status === 'canceled') {
          stopped = true;
          window.clearInterval(id);
          router.refresh();
          return;
        }
      } catch {
        // Keep trying until the window closes.
      }
      if (attempts >= 14 && !stopped) {
        window.clearInterval(id);
        setGaveUp(true);
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [orderNumber, token, router]);

  return (
    <div role="status" aria-live="polite" className="grid gap-2">
      {gaveUp ? (
        <>
          <p className="text-[1.125rem] font-semibold text-night-text">Payment went through. Your tickets are on the way by email.</p>
          <p className="text-[0.9375rem] leading-relaxed text-night-soft">
            This page will show them as soon as the bank confirms. Refresh in a moment, or check your inbox.
          </p>
        </>
      ) : (
        <>
          <p className="text-[1.125rem] font-semibold text-night-text">Confirming your payment…</p>
          <p className="text-[0.9375rem] leading-relaxed text-night-soft">This usually takes a second or two.</p>
        </>
      )}
    </div>
  );
}
