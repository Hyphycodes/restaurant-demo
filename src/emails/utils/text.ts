import type { EmailBrand, EmailCustomer, EmailEvent, EmailOrder, EmailTicket } from '../types';
import { formatEventDateLong, formatEventTime, formatPrice, formatTimeRangeCompact } from './format';

/**
 * The plain-text half of every email.
 *
 * Written deliberately rather than scraped from the HTML: a text part that
 * reads well is what a watch, a screen reader and a spam filter all see, and
 * the ticket codes have to be in it verbatim so a guest with images off can
 * still read them out at the door.
 */

export function greetingFor(customer: EmailCustomer): string | null {
  return customer.firstName ? `Hi ${customer.firstName},` : null;
}

export function eventLines(event: EmailEvent): string[] {
  const lines = [event.title, `${formatEventDateLong(event.startsAt)} · ${formatTimeRangeCompact(event.startsAt, event.endsAt)}`];
  if (event.doorsAt) lines.push(`Doors ${formatEventTime(event.doorsAt)}`);
  lines.push(`${event.venue.name}, ${event.venue.address}`);
  if (event.agePolicy) lines.push({ all_ages: 'All ages', '18+': '18 and over', '21+': '21 and over, ID required' }[event.agePolicy]);
  return lines;
}

export function ticketLines(tickets: EmailTicket[]): string[] {
  return tickets.map((ticket, index) => {
    const state = ticket.status === 'valid' ? '' : ticket.status === 'checked_in' ? ' — already checked in' : ticket.status === 'void' ? ' — cancelled' : ' — refunded';
    const seats = ticket.seats > 1 ? `, ${ticket.seats} seats` : '';
    return `  ${index + 1}. ${ticket.code}  ${ticket.tierName}${seats}${state}\n     ${ticket.ticketUrl}`;
  });
}

export function orderLines(order: EmailOrder): string[] {
  const lines = [`Order ${order.orderNumber}`, ...order.items.map((item) => `  ${item.quantity} × ${item.tierName}  ${formatPrice(item.subtotalCents)}`)];
  if (order.discountCents > 0) lines.push(`  Discount  −${formatPrice(order.discountCents)}`);
  if (order.serviceFeeCents > 0) lines.push(`  Service fee  ${formatPrice(order.serviceFeeCents)}`);
  if (order.taxCents > 0) lines.push(`  Tax  ${formatPrice(order.taxCents)}`);
  lines.push(`  Paid  ${formatPrice(order.totalCents)}${order.paymentMethod ? ` (${order.paymentMethod})` : ''}`);
  if (order.refundedCents > 0) lines.push(`  Refunded  ${formatPrice(order.refundedCents)}`);
  return lines;
}

export function footerLines(brand: EmailBrand): string[] {
  return [
    '—',
    brand.name,
    `West Loop, Chicago, IL  · ${brand.phone}${brand.supportEmail ? ` · ${brand.supportEmail}` : ''}`,
    `What's on: ${brand.eventsUrl}`,
    `Ticket terms: ${brand.termsUrl}`,
  ];
}

/** Joins sections with a blank line, dropping empties. */
export function joinText(...sections: (string | string[] | null | undefined | false)[]): string {
  return sections
    .filter((section): section is string | string[] => Boolean(section))
    .map((section) => (Array.isArray(section) ? section.join('\n') : section))
    .filter((section) => section.length > 0)
    .join('\n\n');
}
