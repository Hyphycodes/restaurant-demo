import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Brightness } from '@/components/tickets/Brightness';
import { Frame } from '@/components/primitives/Band';
import { ExternalTextLink } from '@/components/primitives/Button';
import { getSiteSettings } from '@/content/resolve';
import { addToCalendarUrl, standaloneEvents } from '@/lib/events';
import { formatEventDateLong, formatEventTime, formatTimeRangeCompact } from '@/lib/format';
import { ticketQrDataUrl } from '@/lib/tickets/qr';
import { ticketLink } from '@/lib/tickets/link';
import { isSigningConfigured, verifyTicketToken } from '@/lib/ticketing/tokens';
import { getPublicEvents } from '@/server/content/events';
import { getTicketingClient } from '@/server/ticketing/db';
import { getOrderById } from '@/server/ticketing/orders';
import { overLimit } from '@/server/ticketing/rate-limit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your ticket — Cosa Nostra',
  robots: { index: false, follow: false, nocache: true },
  // The token is the credential; it must not ride along in a Referer header to
  // Google Maps or anywhere else this page links to.
  referrer: 'no-referrer',
};

/**
 * One ticket, one link, no account.
 *
 * This is what the QR actually points at, and what a buyer forwards to each
 * friend: four people who arrive separately each hold their own. The token is
 * the credential, so the page is rate limited, never indexed, sends no
 * referrer, and answers a bad token with the same not-found as a missing one —
 * it never says which part was wrong.
 *
 * What it deliberately does NOT show: what anyone paid. A forwarded ticket
 * should get its holder through the door without handing them the receipt.
 */
export default async function SingleTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw ?? '');

  // Hard rate limit: a token is guessable only by brute force, and this is
  // where that would be attempted.
  const heads = await headers();
  const ip = heads.get('x-forwarded-for')?.split(',')[0]?.trim() || heads.get('x-real-ip') || 'local';
  if (await overLimit(`ticket:${ip}`, 60, 60)) notFound();

  // Without the signing secret no token can be verified — and no ticket can
  // have been issued either, so there is nothing this page could show. Not
  // found, not a crash.
  if (!isSigningConfigured()) notFound();
  const verified = verifyTicketToken(token);
  if (!verified) notFound();

  const client = getTicketingClient();
  if (!client) notFound();
  const { data: row } = await client
    .from('tickets')
    .select('id, order_id, event_id, code, status, seats, attendee_name, checked_in_at, order_item_id')
    .eq('id', verified.tid)
    .maybeSingle();
  if (!row || String(row.event_id) !== verified.eid) notFound();

  const order = await getOrderById(String(row.order_id));
  if (!order) notFound();

  const [input, settings] = await Promise.all([getPublicEvents(), getSiteSettings()]);
  const event = standaloneEvents(input.occurrences).find((entry) => entry.overrideId === order.eventId) ?? null;
  const address = `${settings.street}, ${settings.locality}, ${settings.region} ${settings.postalCode}`;
  const tierName = order.items.find((item) => item.id === String(row.order_item_id))?.tierName ?? 'Ticket';
  const position = order.tickets.findIndex((ticket) => ticket.id === String(row.id)) + 1;
  const status = String(row.status) as 'valid' | 'checked_in' | 'void' | 'refunded';
  const dead = status === 'void' || status === 'refunded';

  // Drawn here rather than fetched: the QR must be on screen even when images
  // are blocked or the connection dies between HTML and image.
  const qr = await ticketQrDataUrl(ticketLink(token), 640);

  return (
    <section className="o-band relative isolate bg-espresso on-dark py-(--spacing-band-sm)" aria-labelledby="ticket-title">
      <Frame>
        <div className="mx-auto max-w-[520px]">
          <p className="text-[0.875rem] text-night-soft">Order {order.orderNumber}</p>
          <h1 id="ticket-title" className="display mt-2 text-[clamp(1.75rem,5vw,2.5rem)] leading-none text-night-text">
            {event?.title ?? 'Your ticket'}
          </h1>
          {event ? (
            <p className="tabular mt-3 text-[1rem] text-night-text">
              {formatEventDateLong(event.startsAt)} · {formatTimeRangeCompact(event.startsAt, event.endsAt)}
            </p>
          ) : null}
          {event?.ticketing.doorsOpenAt ? (
            <p className="text-[0.9375rem] text-night-soft">Doors {formatEventTime(event.ticketing.doorsOpenAt)}</p>
          ) : null}
          <p className="mt-1 text-[0.9375rem] text-night-soft">
            {event?.venueName ?? settings.name}, {address}
          </p>

          <div className="mt-7 overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-espresso-lift/80">
            {/* Solid white behind the code, always. A transparent QR on a dark
                page is the most common broken-ticket call there is. */}
            <div className={`bg-white p-5 ${dead ? 'opacity-25' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code for ticket ${String(row.code)}`} width={640} height={640} className="mx-auto aspect-square w-full max-w-[360px]" />
            </div>
            <div className="p-5">
              <p className="tabular text-[1.5rem] font-semibold tracking-[0.06em] text-night-text">{String(row.code)}</p>
              <p className="mt-1.5 text-[0.9375rem] text-night-soft">
                {tierName}
                {Number(row.seats ?? 1) > 1 ? ` · admits ${Number(row.seats)}` : ''}
                {order.tickets.length > 1 ? ` · ticket ${position} of ${order.tickets.length}` : ''}
              </p>
              {row.attendee_name ? (
                <p className="mt-1 text-[0.9375rem] text-night-text">{String(row.attendee_name)}</p>
              ) : null}
              <Status status={status} checkedInAt={row.checked_in_at ? String(row.checked_in_at) : null} />
            </div>
          </div>

          <Brightness />

          <div className="mt-8 border-t border-night-text/12 pt-6">
            <h2 className="text-[1.0625rem] font-semibold text-night-text">Getting in</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-night-soft">
              Show this code at the door. If your phone dies, staff can find you by the name or
              email on the order — nobody gets stuck outside.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              <ExternalTextLink href={settings.directionsUrl} destination="Google Maps" className="text-amber">
                Directions
              </ExternalTextLink>
              {event ? (
                <ExternalTextLink href={addToCalendarUrl(event, address)} destination="Google Calendar" className="text-amber">
                  Add to calendar
                </ExternalTextLink>
              ) : null}
            </div>
            {/* Deliberately not a button yet: a dead control that looks live is
                worse than an honest note. The token model is already wallet
                compatible — see docs/ticketing-email.md. */}
            <p className="mt-4 text-[0.8125rem] text-night-soft">
              Apple and Google Wallet passes are coming later. For now this page is the ticket —
              add it to your home screen if you want it one tap away.
            </p>
          </div>
        </div>
      </Frame>
    </section>
  );
}

function Status({ status, checkedInAt }: { status: string; checkedInAt: string | null }) {
  if (status === 'checked_in') {
    return (
      <p className="mt-3 inline-flex items-center rounded-(--radius-sm) border border-success/60 bg-success/10 px-3 py-1.5 text-[0.875rem] font-semibold text-success">
        Checked in{checkedInAt ? ` at ${formatEventTime(checkedInAt)}` : ''}
      </p>
    );
  }
  if (status === 'refunded') {
    return (
      <p className="mt-3 inline-flex items-center rounded-(--radius-sm) border border-danger/60 bg-danger/10 px-3 py-1.5 text-[0.875rem] font-semibold text-danger">
        Refunded — no longer valid
      </p>
    );
  }
  if (status === 'void') {
    return (
      <p className="mt-3 inline-flex items-center rounded-(--radius-sm) border border-danger/60 bg-danger/10 px-3 py-1.5 text-[0.875rem] font-semibold text-danger">
        Cancelled — no longer valid
      </p>
    );
  }
  return (
    <p className="mt-3 inline-flex items-center rounded-(--radius-sm) border border-night-text/25 px-3 py-1.5 text-[0.875rem] font-semibold text-night-text">
      Valid
    </p>
  );
}
