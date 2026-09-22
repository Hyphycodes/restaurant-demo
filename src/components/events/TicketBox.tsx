'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { formatPrice } from '@/lib/format';
import {
  estimateTotalCents,
  faceTotalCents,
  isSoldOut,
  maxAddable,
  priceHeadline,
  scarcityLine,
  type TicketOffer,
} from '@/lib/ticketing/offer';

/**
 * The one bold element on the event page besides the title.
 *
 * It renders the offer it is handed and nothing else: prices come from the
 * server, quantities are the only thing a guest changes here, and the total
 * shown is a face-value preview the server recomputes at checkout. The box is
 * commercially clean — no decoration is ever placed inside it.
 */

const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-(--radius-md) bg-amber px-6 text-[1.0625rem] font-semibold text-on-orange transition-colors hover:bg-amber-bright focus-visible:outline-amber-bright disabled:cursor-not-allowed disabled:opacity-50';

export function TicketBox({
  offer,
  eventId,
  eventSlug,
  eventTitle,
}: {
  offer: TicketOffer;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
}) {
  const soldOut = isSoldOut(offer);
  const headline = priceHeadline(offer);
  const scarcity = scarcityLine(offer);

  return (
    <section
      id="tickets"
      data-ticket-box
      aria-labelledby="tickets-heading"
      className="scroll-mt-24 rounded-(--radius-lg) border border-night-text/12 bg-espresso-lift/80 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="tickets-heading" className="display text-[clamp(1.75rem,3vw,2.25rem)] leading-none text-night-text">
          {soldOut ? 'Sold out' : headline}
        </h2>
        {scarcity && !soldOut ? (
          <p className="tabular text-[0.9375rem] font-medium text-amber">{scarcity}</p>
        ) : null}
      </div>

      {soldOut ? (
        <Waitlist eventId={eventId} />
      ) : offer.kind === 'tiers' ? (
        <TierPicker offer={offer} eventSlug={eventSlug} />
      ) : offer.kind === 'external' ? (
        <div className="mt-5">
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            className={BUTTON}
          >
            {offer.label ?? 'Get tickets'}
            <span className="sr-only">for {eventTitle} (opens the ticket page in a new tab)</span>
          </a>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-night-soft">
            Tickets are sold through {hostLabel(offer.url)}. Any service fee is shown there before you pay.
          </p>
        </div>
      ) : offer.kind === 'free' ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-night-soft">
          No ticket needed. Come in, grab a table and settle in.
        </p>
      ) : offer.kind === 'pending' ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-night-soft">
          Tickets go on sale here soon. Check back shortly.
        </p>
      ) : (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-night-soft">
          Tickets are sold at the door on the night. Arrive early if you want a table.
        </p>
      )}
    </section>
  );
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('tickeri')) return 'Tickeri';
    if (host.includes('eventbrite')) return 'Eventbrite';
    return host;
  } catch {
    return 'the ticket seller';
  }
}

/* ----------------------------------------------------------------- tiers -- */

function TierPicker({
  offer,
  eventSlug,
}: {
  offer: Extract<TicketOffer, { kind: 'tiers' }>;
  eventSlug: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A code is a promoter's name as often as it is a discount, so it is offered
  // quietly rather than shouted: nobody buying at full price should feel they
  // are missing one.
  const [codeOpen, setCodeOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const promoId = useId();
  const face = useMemo(() => faceTotalCents(offer.tiers, quantities), [offer.tiers, quantities]);
  const { feeCents, totalCents: total } = useMemo(() => estimateTotalCents(face, offer.fees), [face, offer.fees]);
  const count = Object.values(quantities).reduce((sum, n) => sum + n, 0);

  // Seats already chosen across every tier count against the event cap.
  const seatsChosen = offer.tiers.reduce(
    (sum, tier) => sum + tier.seatsPerTicket * (quantities[tier.id] ?? 0),
    0,
  );
  const remainingForMore = offer.remaining === null ? null : offer.remaining - seatsChosen;

  const change = (tierId: string, delta: number, max: number) => {
    setError(null);
    setQuantities((current) => {
      const next = Math.max(0, Math.min(max, (current[tierId] ?? 0) + delta));
      return { ...current, [tierId]: next };
    });
  };

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (count === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const items = offer.tiers
        .filter((tier) => (quantities[tier.id] ?? 0) > 0)
        .map((tier) => ({ tierId: tier.id, quantity: quantities[tier.id] ?? 0 }));
      const code = promoCode.trim();
      const response = await fetch('/api/checkout/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId: offer.eventId, items, ...(code ? { promoCode: code } : {}) }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; orderNumber?: string; message?: string; code?: string }
        | null;
      if (!response.ok || !data?.orderNumber) {
        if (data?.code === 'PROMO_INVALID') setCodeOpen(true);
        setError(data?.message ?? 'Checkout is not open yet. Try again in a moment.');
        setBusy(false);
        return;
      }
      window.location.assign(`/events/${eventSlug}/checkout?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      setError('Could not reach checkout. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={checkout} className="mt-5">
      <ul className="divide-y divide-night-text/10 border-y border-night-text/10">
        {offer.tiers.map((tier) => {
          const quantity = quantities[tier.id] ?? 0;
          // What this tier could still take: its own cap plus whatever the event
          // has left after the other tiers' picks.
          const headroom = remainingForMore === null ? null : remainingForMore + tier.seatsPerTicket * quantity;
          const max = maxAddable(tier, headroom);
          const tierSoldOut = !tier.onSale || max === 0 && quantity === 0;
          return (
            <li key={tier.id} className="flex items-center gap-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-semibold text-night-text">{tier.name}</p>
                {tier.description ? (
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-night-soft">{tier.description}</p>
                ) : null}
                {!tier.onSale ? (
                  <p className="mt-0.5 text-[0.8125rem] text-night-soft">Not on sale right now</p>
                ) : tier.available !== null && tier.available <= 0 ? (
                  <p className="mt-0.5 text-[0.8125rem] text-night-soft">Sold out</p>
                ) : null}
              </div>
              <p className="tabular w-16 shrink-0 text-right text-[1rem] font-semibold text-night-text">
                {tier.priceCents === 0 ? 'Free' : formatPrice(tier.priceCents)}
              </p>
              <Stepper
                label={tier.name}
                value={quantity}
                disabled={tierSoldOut}
                canAdd={quantity < max}
                onChange={(delta) => change(tier.id, delta, max)}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-baseline justify-between gap-4" aria-live="polite">
        <p className="text-[0.9375rem] text-night-soft">
          {count === 0 ? 'Choose your tickets' : `${count} ${count === 1 ? 'ticket' : 'tickets'}`}
        </p>
        <p className="tabular text-[1.375rem] font-semibold text-night-text">
          {count === 0 ? '' : total === 0 ? 'Free' : formatPrice(total)}
        </p>
      </div>

      {codeOpen ? (
        <div className="mt-4">
          <label htmlFor={promoId} className="block text-[0.875rem] font-semibold text-night-text">
            Promo or promoter code
          </label>
          <input
            id={promoId}
            name="promoCode"
            value={promoCode}
            onChange={(event) => { setPromoCode(event.target.value); setError(null); }}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            placeholder="COSA_NOSTRA10"
            className="mt-1.5 min-h-12 w-full rounded-(--radius-md) border border-night-text/25 bg-obsidian/40 px-4 text-[1rem] uppercase tracking-[0.06em] text-night-text placeholder:normal-case placeholder:tracking-normal placeholder:text-night-soft/60 focus:border-amber"
          />
          {/* The price here is the face value. What a code takes off is worked
              out on the server at checkout, where the total is the real one. */}
          <p className="mt-2 text-[0.8125rem] text-night-soft">Applied at checkout, where you will see the new total before paying.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCodeOpen(true)}
          className="mt-3 inline-flex min-h-11 items-center text-[0.875rem] text-night-soft underline underline-offset-4 hover:text-night-text"
        >
          Have a code?
        </button>
      )}

      <button type="submit" className={`${BUTTON} mt-4`} disabled={count === 0 || busy}>
        {busy ? 'One moment…' : 'Get tickets'}
      </button>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-night-soft">
        {feeCents > 0 ? `Includes a ${formatPrice(feeCents)} service fee. That total is exactly what you'll pay.` : 'Nothing added at checkout.'}
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-(--radius-sm) border border-amber/40 bg-amber/10 px-3 py-2 text-[0.875rem] text-night-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Stepper({
  label,
  value,
  disabled,
  canAdd,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  canAdd: boolean;
  onChange: (delta: number) => void;
}) {
  const id = useId();
  const button =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) border border-night-text/25 text-[1.25rem] leading-none text-night-text transition-colors hover:border-amber hover:text-amber disabled:opacity-35 disabled:hover:border-night-text/25 disabled:hover:text-night-text';
  return (
    <div className="flex shrink-0 items-center gap-1.5" role="group" aria-labelledby={id}>
      <span id={id} className="sr-only">
        {label} quantity
      </span>
      <button type="button" className={button} aria-label={`Remove one ${label}`} onClick={() => onChange(-1)} disabled={disabled || value === 0}>
        −
      </button>
      <output className="tabular w-7 text-center text-[1.0625rem] font-semibold text-night-text" aria-live="polite">
        {value}
      </output>
      <button type="button" className={button} aria-label={`Add one ${label}`} onClick={() => onChange(1)} disabled={disabled || !canAdd}>
        +
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- waitlist -- */

function Waitlist({ eventId }: { eventId: string }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ kind: 'idle' });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, email }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (response.ok && data?.ok) setState({ kind: 'done', message: data.message });
      else setState({ kind: 'error', message: data?.message ?? 'Could not save that. Try again in a moment.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach us. Check your connection and try again.' });
    }
  }

  if (state.kind === 'done') {
    return (
      <p role="status" className="mt-4 text-[0.9375rem] leading-relaxed text-night-text">
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <p className="text-[0.9375rem] leading-relaxed text-night-soft">
        Every seat is taken. Leave an email and we will tell you if any open up.
      </p>
      <label htmlFor={id} className="mt-4 block text-[0.875rem] font-semibold text-night-text">
        Your email
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 flex-1 rounded-(--radius-md) border border-night-text/25 bg-obsidian/40 px-4 text-[1rem] text-night-text placeholder:text-night-soft/60 focus:border-amber"
          placeholder="you@example.com"
        />
        <button type="submit" className={`${BUTTON} sm:w-auto`} disabled={state.kind === 'busy'}>
          {state.kind === 'busy' ? 'Saving…' : 'Tell me if tickets open up'}
        </button>
      </div>
      {state.kind === 'error' ? (
        <p role="alert" className="mt-2 text-[0.875rem] text-amber">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
