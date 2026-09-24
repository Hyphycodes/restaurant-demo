import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TicketStatusPoll } from '@/components/tickets/TicketStatusPoll';
import { ResendButton } from '@/components/tickets/ResendButton';
import { UnlockForm } from '@/components/tickets/UnlockForm';
import { Frame } from '@/components/primitives/Band';
import { ExternalTextLink } from '@/components/primitives/Button';
import { getSiteSettings } from '@/content/resolve';
import { addToCalendarUrl, standaloneEvents } from '@/lib/events';
import { formatEventDateLong, formatPrice, formatTimeRangeCompact } from '@/lib/format';
import { ticketPath } from '@/lib/tickets/link';
import { signTicketToken, verifyOrderToken } from '@/lib/ticketing/tokens';
import { getPublicEvents } from '@/server/content/events';
import { resolveEventArtwork } from '@/server/content/event-art';
import { getOrderByNumber, holdIsLive, isPaidStatus, type OrderRecord, type TicketRecord } from '@/server/ticketing/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your tickets — Casa Aurelia', robots: { index: false, follow: false } };

/**
 * The tickets page.
 *
 * Reachable with the signed link from the confirmation email (30 days) or by
 * entering the email on the order. The order number alone opens nothing.
 * While the webhook is on its way it waits; once paid it shows one QR per
 * ticket, the codes as text, the address and a calendar link.
 */
export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string; redirect_status?: string }>;
}) {
  const [{ orderNumber }, { t: token, redirect_status: redirectStatus }] = await Promise.all([params, searchParams]);
  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const unlocked = Boolean(token) && verifyOrderToken(token!) === order.id;
  if (!unlocked) {
    return (
      <Shell title="Your tickets" orderNumber={order.orderNumber}>
        <UnlockForm orderNumber={order.orderNumber} />
      </Shell>
    );
  }

  const [input, settings] = await Promise.all([getPublicEvents(), getSiteSettings()]);
  const event = standaloneEvents(input.occurrences).find((entry) => entry.overrideId === order.eventId) ?? null;
  const artwork = event ? await resolveEventArtwork(event) : null;
  const address = `${settings.street}, ${settings.locality}, ${settings.region} ${settings.postalCode}`;
  const paid = isPaidStatus(order.status);

  return (
    <Shell title={paid ? "You're in" : 'Your tickets'} orderNumber={order.orderNumber}>
      {event ? (
        <div className="flex gap-4">
          {artwork?.flyer?.path ? (
            <div className="w-24 shrink-0 overflow-hidden rounded-(--radius-md) bg-obsidian p-1 sm:w-32">
              <Image src={artwork.flyer.path} alt="" width={artwork.flyer.width || 400} height={artwork.flyer.height || 400} sizes="128px" className="h-auto w-full rounded-(--radius-sm)" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="display text-[clamp(1.5rem,3vw,2rem)] leading-[1.02] text-night-text">{event.title}</p>
            <p className="tabular mt-2 text-[1rem] text-night-text">
              {formatEventDateLong(event.startsAt)} · {formatTimeRangeCompact(event.startsAt, event.endsAt)}
            </p>
            <p className="mt-1 text-[0.9375rem] text-night-soft">{event.venueName}, {address}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        {paid ? (
          <Tickets order={order} token={token!} />
        ) : redirectStatus === 'failed' || order.status === 'failed' ? (
          <p className="text-[1.125rem] text-night-text">
            The payment did not go through. Nothing was charged.{' '}
            {event ? (
              <Link href={`/events/${event.slug}`} className="underline underline-offset-4">Try again from the event page.</Link>
            ) : null}
          </p>
        ) : order.status === 'canceled' ? (
          <p className="text-[1.125rem] text-night-text">
            This order was not completed. Nothing was charged.{' '}
            {event ? <Link href={`/events/${event.slug}`} className="underline underline-offset-4">Back to the event.</Link> : null}
          </p>
        ) : order.status === 'refunded' ? (
          <p className="text-[1.125rem] text-night-text">This order was refunded. These tickets are no longer valid.</p>
        ) : order.status === 'disputed' ? (
          <p className="text-[1.125rem] text-night-text">There is a problem with the payment on this order. Call us at {settings.phone.value}.</p>
        ) : holdIsLive(order) || order.stripePaymentIntentId ? (
          <TicketStatusPoll orderNumber={order.orderNumber} token={token!} />
        ) : (
          <p className="text-[1.125rem] text-night-text">This order was not completed. Nothing was charged.</p>
        )}
      </div>

      {paid && event ? (
        <div className="mt-10 grid gap-8 border-t border-night-text/12 pt-8 sm:grid-cols-2">
          <div>
            <h2 className="text-[1.0625rem] font-semibold text-night-text">On the night</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-night-soft">
              Show any of these codes at the door, on your phone or printed. Arrive a little early if you want to pick your seat.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6">
              <ExternalTextLink href={settings.directionsUrl} destination="Google Maps" className="text-amber">Directions</ExternalTextLink>
              <ExternalTextLink href={addToCalendarUrl(event, address)} destination="Google Calendar" className="text-amber">Add to calendar</ExternalTextLink>
            </div>
          </div>
          <div>
            <h2 className="text-[1.0625rem] font-semibold text-night-text">Your order</h2>
            <dl className="mt-2 text-[0.9375rem] text-night-soft">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-1">
                  <dt>{item.quantity} × {item.tierName}</dt>
                  <dd className="tabular">{formatPrice(item.subtotalCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-night-text/12 py-2 text-night-text">
                <dt className="font-semibold">Paid</dt>
                <dd className="tabular font-semibold">{formatPrice(order.totalCents)}</dd>
              </div>
            </dl>
            {order.consentText ? <p className="mt-3 text-[0.8125rem] leading-relaxed text-night-soft">{order.consentText}</p> : null}
            <ResendButton orderNumber={order.orderNumber} token={token!} />
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ title, orderNumber, children }: { title: string; orderNumber: string; children: React.ReactNode }) {
  return (
    <section className="o-band relative isolate bg-espresso on-dark py-(--spacing-band-sm)" aria-labelledby="tickets-title">
      <Frame>
        <p className="text-[0.875rem] text-night-soft">Order {orderNumber}</p>
        <h1 id="tickets-title" className="display mt-2 text-[clamp(2rem,5vw,3.25rem)] leading-none text-night-text">
          {title}
        </h1>
        <div className="mt-8">{children}</div>
      </Frame>
    </section>
  );
}

function Tickets({ order, token }: { order: OrderRecord; token: string }) {
  const tierName = (ticket: TicketRecord) => order.items.find((item) => item.id === ticket.orderItemId)?.tierName ?? 'Ticket';
  return (
    <>
    {order.tickets.length > 1 ? (
      <p className="mb-5 text-[0.9375rem] leading-relaxed text-night-soft">
        Each ticket has its own page — open one and send that link to whoever is using it. Four
        friends do not always arrive together.
      </p>
    ) : null}
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {order.tickets.map((ticket, index) => {
        const dead = ticket.status === 'void' || ticket.status === 'refunded';
        return (
          <li key={ticket.id} className="overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-espresso-lift/80">
            {/* Solid white behind the QR, always: a transparent code on a dark
                page is the most common broken-ticket call there is. */}
            <div className={`bg-white p-4 ${dead ? 'opacity-30' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/tickets/${ticket.id}/qr.png?t=${encodeURIComponent(token)}`}
                alt={`QR code for ticket ${ticket.code}`}
                width={600}
                height={600}
                className="mx-auto aspect-square w-full max-w-[280px]"
              />
            </div>
            <div className="p-4">
              <p className="tabular text-[1.375rem] font-semibold tracking-[0.06em] text-night-text">{ticket.code}</p>
              <p className="mt-1 text-[0.9375rem] text-night-soft">
                {tierName(ticket)}
                {ticket.seats > 1 ? ` · ${ticket.seats} seats` : ''} · {index + 1} of {order.tickets.length}
              </p>
              {dead ? <p className="mt-2 text-[0.9375rem] font-semibold text-amber">No longer valid</p> : null}
              {ticket.status === 'checked_in' ? <p className="mt-2 text-[0.9375rem] text-night-soft">Already used at the door</p> : null}
              <Link
                href={ticketPath(signTicketToken(ticket.id, order.eventId))}
                className="mt-3 inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-amber underline underline-offset-4"
              >
                {order.tickets.length > 1 ? 'Open this one on its own' : 'Open this ticket on its own'}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
    </>
  );
}
