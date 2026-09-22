import 'server-only';

import { INLINE_TICKET_LIMIT } from '@/emails/components/TicketCard';
import type { EmailBrand, EmailCustomer, EmailEvent, EmailOrder, EmailTicket } from '@/emails/types';
import { getSiteSettings } from '@/content/resolve';
import type { ResolvedEvent } from '@/content/types';
import { getReadDb } from '@/lib/db';
import { standaloneEvents } from '@/lib/events';
import { absoluteUrl } from '@/lib/site-url';
import { ticketLink } from '@/lib/tickets/link';
import { ticketQrPng } from '@/lib/tickets/qr';
import { isSigningConfigured, signOrderToken, signTicketToken } from '@/lib/ticketing/tokens';
import { resolveEventArtwork } from '@/server/content/event-art';
import { getEditableEvents, getPublicEvents } from '@/server/content/events';
import type { OrderRecord, TicketRecord } from '@/server/ticketing/orders';
import { firstNameOf } from '@/emails/utils/format';
import type { EmailAttachment } from './transport';

/**
 * Production records → template props.
 *
 * The templates know nothing about Supabase, Stripe or the media registry.
 * Everything they need is mapped here, once, from the same loaders the
 * website uses — so the email and the event page can never disagree about
 * a time, an address or which flyer is current.
 */

export async function loadBrand(): Promise<EmailBrand> {
  const settings = await getSiteSettings();
  const support = process.env.EMAIL_REPLY_TO?.trim() || process.env.ORDERS_FROM_EMAIL?.trim() || null;
  return {
    name: settings.name,
    shortName: settings.shortName,
    siteUrl: absoluteUrl('/').replace(/\/$/, ''),
    logoUrl: absoluteUrl('/media/brandLogo.webp'),
    phone: settings.phone.value,
    supportEmail: support && !/resend\.dev$/i.test(support) ? support : null,
    eventsUrl: absoluteUrl('/events'),
    termsUrl: absoluteUrl('/legal/tickets'),
    instagramUrl: settings.socials.find((social) => social.platform === 'instagram')?.url ?? null,
  };
}

function toAbsolute(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : absoluteUrl(path);
}

async function toEmailEvent(event: ResolvedEvent): Promise<EmailEvent> {
  const [settings, artwork] = await Promise.all([getSiteSettings(), resolveEventArtwork(event)]);
  const flyer = artwork.flyer?.path ? artwork.flyer : null;
  const address = event.ticketing.venueAddress?.trim() || `${settings.street}, ${settings.locality}, ${settings.region} ${settings.postalCode}`;
  return {
    id: event.overrideId ?? event.id,
    title: event.title,
    summary: event.summary?.trim() || null,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    doorsAt: event.ticketing.doorsOpenAt,
    venue: { name: event.venueName, address, directionsUrl: settings.directionsUrl },
    artworkUrl: toAbsolute(flyer?.path),
    artworkWidth: flyer?.width || null,
    artworkHeight: flyer?.height || null,
    accentColor: event.details.accentHint,
    arrivalNote: event.details.arrivalText?.trim() || event.ageNote?.trim() || null,
    agePolicy: event.ticketing.agePolicy,
    refundPolicy: event.ticketing.refundPolicy?.trim() || null,
    eventUrl: absoluteUrl(event.slug ? `/events/${event.slug}` : '/events'),
    status: event.status,
  };
}

/**
 * One ticketed event, by its `event_occurrences` id.
 *
 * Published events come from the public loader. `includeDrafts` (admin
 * previews only) also finds an unpublished one through the working view.
 */
export async function loadEmailEvent(eventId: string, options: { includeDrafts?: boolean } = {}): Promise<EmailEvent | null> {
  const published = await getPublicEvents();
  let event = standaloneEvents(published.occurrences).find((entry) => entry.overrideId === eventId) ?? null;
  if (!event && options.includeDrafts) {
    const db = getReadDb();
    if (db) {
      const working = await getEditableEvents(db);
      event = standaloneEvents(working.occurrences).find((entry) => entry.overrideId === eventId) ?? null;
    }
  }
  return event ? toEmailEvent(event) : null;
}

/** Ticketed events staff can pick from, upcoming first. Drafts included, labelled. */
export async function listEventsForEmail(): Promise<{ id: string; title: string; startsAt: string; published: boolean; ticketing: boolean }[]> {
  const db = getReadDb();
  const input = db ? await getEditableEvents(db) : await getPublicEvents();
  const cutoff = Date.now() - 14 * 86_400_000;
  return standaloneEvents(input.occurrences)
    .filter((event) => Date.parse(event.endsAt) > cutoff)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((event) => ({ id: event.overrideId ?? event.id, title: event.title, startsAt: event.startsAt, published: event.published, ticketing: event.ticketing.enabled }));
}

export function customerFromOrder(order: OrderRecord): EmailCustomer {
  const fullName = order.customerName?.trim() || null;
  return { email: order.customerEmail?.trim() ?? '', firstName: firstNameOf(fullName), fullName };
}

export function orderTicketsUrl(order: OrderRecord): string {
  return absoluteUrl(`/tickets/${order.orderNumber}?t=${encodeURIComponent(signOrderToken(order.id))}`);
}

export function orderToEmail(order: OrderRecord): EmailOrder {
  return {
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({ tierName: item.tierName, quantity: item.quantity, unitPriceCents: item.unitPriceCents, subtotalCents: item.subtotalCents })),
    subtotalCents: order.subtotalCents,
    serviceFeeCents: order.serviceFeeCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    paidAt: order.paidAt,
    ticketsUrl: orderTicketsUrl(order),
    paymentMethod: null,
  };
}

/** The tickets on an order that can still be used. */
export function liveTickets(order: OrderRecord): TicketRecord[] {
  return order.tickets.filter((ticket) => ticket.status === 'valid' || ticket.status === 'checked_in');
}

function tierNameFor(order: OrderRecord, ticket: TicketRecord): string {
  return order.items.find((item) => item.id === ticket.orderItemId)?.tierName ?? 'Ticket';
}

/**
 * Ticket records → email tickets, with the QR carried as an inline PNG.
 *
 * Each ticket's link is its signed token, the same one the door verifies.
 * The PNG is attached and referenced by `cid:`, so it renders when remote
 * images are blocked and never touches a data URL Gmail would strip. Only
 * the tickets the template will actually show get an attachment.
 */
export async function ticketsToEmail(
  order: OrderRecord,
  tickets: TicketRecord[],
  options: { qr: 'attach' | 'none' } = { qr: 'attach' },
): Promise<{ tickets: EmailTicket[]; attachments: EmailAttachment[] }> {
  const signed = isSigningConfigured();
  const shownCount = tickets.length > INLINE_TICKET_LIMIT ? 1 : tickets.length;
  const attachments: EmailAttachment[] = [];
  const result: EmailTicket[] = [];
  for (const [index, ticket] of tickets.entries()) {
    const ticketUrl = signed ? ticketLink(signTicketToken(ticket.id, order.eventId)) : orderTicketsUrl(order);
    const live = ticket.status === 'valid' || ticket.status === 'checked_in';
    let qrSrc: string | null = null;
    if (options.qr === 'attach' && signed && live && index < shownCount) {
      const cid = `qr${index + 1}`;
      attachments.push({ filename: `${ticket.code}.png`, content: await ticketQrPng(ticketUrl), contentType: 'image/png', contentId: cid });
      qrSrc = `cid:${cid}`;
    }
    result.push({
      id: ticket.id,
      code: ticket.code,
      tierName: tierNameFor(order, ticket),
      seats: ticket.seats,
      status: ticket.status,
      attendeeName: ticket.attendeeName,
      qrSrc,
      ticketUrl,
    });
  }
  return { tickets: result, attachments };
}

/** Fixture-shaped tickets given real PNG QRs, so a test send looks exactly like a real one. */
export async function attachFixtureQrs(tickets: EmailTicket[]): Promise<{ tickets: EmailTicket[]; attachments: EmailAttachment[] }> {
  const shownCount = tickets.length > INLINE_TICKET_LIMIT ? 1 : tickets.length;
  const attachments: EmailAttachment[] = [];
  const result: EmailTicket[] = [];
  for (const [index, ticket] of tickets.entries()) {
    if (index < shownCount && ticket.qrSrc) {
      const cid = `qr${index + 1}`;
      attachments.push({ filename: `${ticket.code}.png`, content: await ticketQrPng(ticket.ticketUrl), contentType: 'image/png', contentId: cid });
      result.push({ ...ticket, qrSrc: `cid:${cid}` });
    } else {
      result.push({ ...ticket, qrSrc: null });
    }
  }
  return { tickets: result, attachments };
}
