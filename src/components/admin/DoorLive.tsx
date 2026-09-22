'use client';

import { useEffect, useState } from 'react';
import type { DoorSnapshot } from '@/server/ticketing/insight';

/**
 * The page Adrian actually holds on a Saturday.
 *
 * Polling, not realtime: one small request every ten seconds is enough for a
 * number that changes as fast as people walk through a door, and it keeps
 * working on the venue wifi where a dropped socket would silently freeze the
 * count — which is worse than a number that is ten seconds old, because it
 * looks alive.
 */

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    .format(new Date(iso))
    .toLowerCase();
}

function money(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function DoorLive({ eventId, initial }: { eventId: string; initial: DoorSnapshot | null }) {
  const [snapshot, setSnapshot] = useState<DoorSnapshot | null>(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch(`/api/door/live?eventId=${encodeURIComponent(eventId)}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { snapshot: DoorSnapshot | null };
        if (cancelled || !data.snapshot) return;
        setSnapshot(data.snapshot);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    const id = window.setInterval(tick, 10_000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId]);

  if (!snapshot) {
    return (
      <p className="rounded-(--radius-md) bg-brown/5 px-4 py-3 text-[0.875rem] text-brown-soft">
        Live counts need the ticketing connection. Scanning still works from the list cached on the
        door phone.
      </p>
    );
  }

  const { checkedIn, issued, notArrived, capacity, recent, money: takings } = snapshot;
  const percent = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;

  return (
    <div className="grid gap-5">
      <div>
        <p className="display tabular text-[clamp(2.5rem,9vw,4rem)] leading-none text-brown">
          {checkedIn} <span className="text-brown-soft">/ {issued}</span>
        </p>
        <p className="mt-1 text-[0.9375rem] text-brown-soft">
          checked in{capacity ? ` · room holds ${capacity}` : ''}
          {stale ? ' · reconnecting' : ''}
        </p>

        {/* A bar, because a number alone does not say "nearly full" at a glance. */}
        <div
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-brown/12"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checked in"
        >
          <div className="h-full rounded-full bg-coral transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-[0.9375rem] text-brown">{notArrived} not here yet</p>
      </div>

      {takings ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-brown/12 pt-4 sm:grid-cols-4">
          <Figure label="Orders" value={String(takings.ordersCount)} />
          <Figure label="Takings" value={money(takings.netCents)} />
          <Figure label="At the door" value={money(takings.doorCents)} />
          <Figure label="Comped" value={String(takings.compOrders)} />
        </dl>
      ) : null}

      <div className="border-t border-brown/12 pt-4">
        <h3 className="text-[0.9375rem] font-semibold text-brown">Just came in</h3>
        {recent.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-brown-soft">Nobody yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-brown/10">
            {recent.map((entry) => (
              <li key={`${entry.ticketId}-${entry.at}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-[0.9375rem] text-brown">
                  {entry.name ?? 'Guest'} <span className="text-brown-soft">· {entry.tierName}</span>
                </span>
                <span className="tabular shrink-0 text-[0.875rem] text-brown-soft">
                  {timeOf(entry.at)}
                  {entry.door ? ` · ${entry.door}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-brown-soft">{label}</dt>
      <dd className="tabular mt-0.5 text-[1.25rem] font-semibold text-brown">{value}</dd>
    </div>
  );
}
