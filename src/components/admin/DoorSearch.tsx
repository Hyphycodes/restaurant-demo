'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CachedManifest } from '@/lib/tickets/scan-cache';

/**
 * Find somebody whose phone is dead.
 *
 * Online it asks the server, which can match an email as well (managers only).
 * Offline it falls back to the manifest already on the device, which carries
 * names and order numbers but deliberately no email addresses — a lost staff
 * phone must not be a copy of the customer list.
 */

export interface SearchMatch {
  ticketId: string;
  code: string;
  name: string | null;
  email: string | null;
  tierName: string;
  orderNumber: string;
  status: string;
  checkedInAt: string | null;
  seats: number;
}

function timeOf(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    .format(new Date(iso))
    .toLowerCase();
}

export function DoorSearch({
  eventId,
  manifest,
  canCheckIn,
  onCheckIn,
  onClose,
}: {
  eventId: string;
  manifest: CachedManifest | null;
  /** Managers only: checking somebody in from search is a judgement call. */
  canCheckIn: boolean;
  onCheckIn: (match: SearchMatch) => Promise<void> | void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [state, setState] = useState<'idle' | 'searching' | 'offline'>('idle');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const offlineSearch = useCallback(
    (term: string): SearchMatch[] => {
      if (!manifest) return [];
      const needle = term.toLowerCase();
      return manifest.tickets
        .filter(
          (ticket) =>
            (ticket.attendeeName ?? '').toLowerCase().includes(needle) ||
            ticket.orderNumber.toLowerCase().includes(needle),
        )
        .slice(0, 20)
        .map((ticket) => ({
          ticketId: ticket.id,
          code: '',
          name: ticket.attendeeName,
          email: null,
          tierName: ticket.tierName,
          orderNumber: ticket.orderNumber,
          status: ticket.status,
          checkedInAt: null,
          seats: ticket.seats,
        }));
    },
    [manifest],
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setMatches([]);
      setState('idle');
      return;
    }
    let cancelled = false;
    setState('searching');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/scan/search?eventId=${encodeURIComponent(eventId)}&q=${encodeURIComponent(term)}`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = (await response.json()) as { matches?: SearchMatch[] };
        if (cancelled) return;
        setMatches(data.matches ?? []);
        setState('idle');
      } catch {
        if (cancelled) return;
        setMatches(offlineSearch(term));
        setState('offline');
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, eventId, offlineSearch]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-obsidian/98 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <input
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, order number or code"
          autoCapitalize="words"
          autoCorrect="off"
          className="min-h-12 flex-1 rounded-(--radius-md) border border-night-text/25 bg-black/40 px-4 text-[1.0625rem] text-night-text placeholder:text-night-soft/60 focus:border-amber"
        />
        <button type="button" onClick={onClose} className="inline-flex min-h-12 items-center px-2 text-[0.9375rem] font-semibold text-night-soft underline underline-offset-4">
          Close
        </button>
      </div>

      <p className="mt-2 text-[0.8125rem] text-night-soft">
        {state === 'offline'
          ? 'Offline — searching the list on this phone. Names and order numbers only.'
          : 'Type at least two characters.'}
      </p>

      <ul className="mt-3 flex-1 divide-y divide-night-text/10 overflow-y-auto">
        {matches.map((match) => {
          const used = match.status === 'checked_in';
          const dead = match.status === 'void' || match.status === 'refunded';
          return (
            <li key={match.ticketId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.0625rem] font-semibold text-night-text">{match.name || match.orderNumber}</p>
                <p className="truncate text-[0.875rem] text-night-soft">
                  {match.tierName}
                  {match.seats > 1 ? ` · admits ${match.seats}` : ''} · {match.orderNumber}
                  {match.email ? ` · ${match.email}` : ''}
                </p>
                {used ? (
                  <p className="text-[0.875rem] text-amber">Already in{match.checkedInAt ? ` at ${timeOf(match.checkedInAt)}` : ''}</p>
                ) : dead ? (
                  <p className="text-[0.875rem] text-danger">{match.status === 'refunded' ? 'Refunded' : 'Cancelled'}</p>
                ) : null}
              </div>
              {canCheckIn && !used && !dead ? (
                <button
                  type="button"
                  onClick={() => void onCheckIn(match)}
                  className="inline-flex min-h-12 shrink-0 items-center rounded-(--radius-md) bg-amber px-5 text-[1rem] font-semibold text-on-orange"
                >
                  Let in
                </button>
              ) : null}
            </li>
          );
        })}
        {query.trim().length >= 2 && matches.length === 0 && state !== 'searching' ? (
          <li className="py-6 text-center text-[0.9375rem] text-night-soft">
            Nobody by that name on this event. Try the order number from their email, or the last
            four of the code.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
