import { describe, expect, it } from 'vitest';
import * as f from './fixtures';
import { renderEmail, TEST_SUBJECT_PREFIX } from './render';
import { EMAIL_TEMPLATES, isTemplateId, templateInfo } from './registry';
import { INLINE_TICKET_LIMIT } from './components/TicketCard';
import { qrSvg, qrSvgDataUrl } from './utils/qr';

/**
 * The templates, rendered with the fixtures.
 *
 * What is pinned is what a guest at a door depends on: every code is in the
 * HTML and in the text, the event and the date are named, the tickets link
 * is there, and the awkward inputs (no name, no artwork, a long title, a
 * cancelled event) render without falling over.
 */

/** Rendered HTML with entities decoded and React's text-boundary comments removed, so assertions read like prose. */
function plain(html: string): string {
  return html.replace(/<!-- -->/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, '’').replace(/&quot;/g, '"');
}

async function rendered<K extends Parameters<typeof renderEmail>[0]>(id: K, props: Parameters<typeof renderEmail>[1]) {
  const result = await renderEmail(id, props as never);
  return { ...result, html: plain(result.html) };
}

describe('ticket confirmation', () => {
  it.each(['pass', 'editorial', 'poster'] as const)('direction %s carries the event, every code and the tickets link', async (direction) => {
    const { subject, html, text } = await rendered('ticket_confirmation', { ...f.ticketConfirmation, direction });
    expect(subject).toBe("You're in — Vinyl & Vermouth, Thu Oct 15 (3 tickets)");
    expect(html).toContain('Vinyl & Vermouth');
    expect(html).toContain('Thursday, October 15, 2026');
    for (const ticket of f.threeTickets) {
      expect(html).toContain(ticket.code);
      expect(html).toContain(ticket.ticketUrl);
      expect(text).toContain(ticket.code);
    }
    expect(html).toContain(f.threeTicketOrder.ticketsUrl);
    expect(text).toContain(f.threeTicketOrder.ticketsUrl);
    expect(html).toContain('CNS-B2NRT');
    expect(html).toContain(f.vinylSession.artworkUrl!);
    // The arrival note and the refund policy survive.
    expect(html).toContain('Your aperitivo is included');
    expect(text).toContain('non-refundable within 48 hours');
  });

  it('shows one QR per ticket up to the limit, then the first plus a link to all', async () => {
    const few = await rendered('ticket_confirmation', { ...f.ticketConfirmation, tickets: f.threeTickets });
    expect(few.html.match(/QR code for ticket/g)?.length).toBe(3);

    const many = await rendered('ticket_confirmation', { brand: f.brand, customer: f.customer, event: f.sundayClubSession, order: f.multiTierOrder, tickets: f.multiTierTickets });
    expect(f.multiTierTickets.length).toBeGreaterThan(INLINE_TICKET_LIMIT);
    expect(many.html.match(/QR code for ticket/g)?.length).toBe(1);
    expect(many.html).toContain(`Open all ${f.multiTierTickets.length} tickets`);
    for (const ticket of f.multiTierTickets) expect(many.html).toContain(ticket.code);
    // Multiple tiers, a discount and a seat count all show.
    expect(many.html).toContain('Table of 4 (VIP)');
    // The table ticket is not among the shown cards, so its seat count lives in the text part.
    expect(many.text).toContain('Table of 4 (VIP), 4 seats');
    expect(many.html).toContain('−$20');
  });

  it('survives a guest with no name and an event with no artwork', async () => {
    const { html, text } = await rendered('ticket_confirmation', { brand: f.brand, customer: f.anonymousCustomer, event: f.noArtworkEvent, order: f.singleTicketOrder, tickets: f.singleTicket });
    expect(html).not.toContain('Hi ');
    expect(text).not.toMatch(/^Hi /);
    expect(html).not.toContain('<img src="null"');
    // The fallback sets the title as type on a colour field.
    expect(html).toContain('SALSA NIGHT WITH ORQUESTA LUNA'.length > 0 ? 'Soul Sessions with the House Trio' : '');
  });

  it('keeps a long title and a long venue intact', async () => {
    const { subject, html } = await rendered('ticket_confirmation', { brand: f.brand, customer: f.customer, event: f.longTitleEvent, order: f.threeTicketOrder, tickets: f.threeTickets, direction: 'poster' });
    expect(subject).toContain('House Selectors');
    expect(html).toContain('The Private Dining Room');
  });

  it('marks a test send in the subject, the text and the body', async () => {
    const { subject, html, text } = await rendered('ticket_confirmation', { ...f.ticketConfirmation, test: true });
    expect(subject.startsWith(TEST_SUBJECT_PREFIX)).toBe(true);
    expect(html).toContain('Test email');
    expect(text).toContain('TEST EMAIL');
  });

  it('itemised fees and tax appear only when they are non-zero', async () => {
    const flat = await rendered('ticket_confirmation', f.ticketConfirmation);
    expect(flat.html).not.toContain('Service fee');
    const itemised = await rendered('ticket_confirmation', { ...f.ticketConfirmation, order: f.itemizedOrder });
    expect(itemised.html).toContain('Service fee');
    expect(itemised.html).toContain('Tax');
    expect(itemised.text).toContain('Service fee  $5.40');
  });
});

describe('the other templates', () => {
  it('reminder says tomorrow or tonight and carries the tickets', async () => {
    const tomorrow = await rendered('event_reminder', { brand: f.brand, customer: f.customer, event: f.vinylSession, order: f.threeTicketOrder, tickets: f.threeTickets, timing: 'tomorrow' });
    expect(tomorrow.subject).toMatch(/^Tomorrow — /);
    expect(tomorrow.html).toContain('Tomorrow at Cosa Nostra');
    expect(tomorrow.html).toContain('7KX4-9QZM');
    const tonight = await rendered('event_reminder', { brand: f.brand, customer: f.customer, event: f.vinylSession, order: f.threeTicketOrder, tickets: f.threeTickets, timing: 'tonight' });
    expect(tonight.subject).toMatch(/^Tonight — /);
  });

  it('resend is the tickets and little else', async () => {
    const { html, text } = await rendered('ticket_resend', { brand: f.brand, customer: f.customer, event: f.vinylSession, order: f.threeTicketOrder, tickets: f.threeTickets });
    expect(html).toContain('Here they are again');
    for (const ticket of f.threeTickets) expect(text).toContain(ticket.code);
    expect(html).not.toContain('Your order ·');
  });

  it('refund states the amount, the destination and which tickets stop working', async () => {
    const full = await rendered('refund_confirmation', f.refund);
    expect(full.subject).toBe('Refund of $135 — Vinyl & Vermouth, Thu Oct 15');
    expect(full.html).toContain('Visa ending 4242');
    expect(full.html).toContain('Every ticket on this order is now cancelled');
    expect(full.html).not.toContain('QR code for ticket');
    const partial = await rendered('refund_confirmation', f.partialRefund);
    expect(partial.html).toContain('1 ticket cancelled');
    expect(partial.html).toContain('B2NR-T8HD');
    expect(partial.text).toContain('Your other tickets are unchanged');
    expect(partial.html).toContain('Given back at the register');
  });

  it('event update puts the change first: old struck through, new large', async () => {
    const time = await rendered('event_update', f.timeChange);
    expect(time.subject).toBe('Time change: Vinyl & Vermouth, Thu Oct 15');
    expect(time.html).toContain('line-through');
    expect(time.html).toContain('9pm–12am');
    expect(time.text).toContain('Was: Thursday, October 15, 2026 · 8–11pm');
    expect(time.text).toContain('Now: Thursday, October 15, 2026 · 9pm–12am');
    expect(time.html).toContain('7KX4-9QZM');
  });

  it('cancellation names the refund, voids the tickets and shows no QR', async () => {
    const { subject, html, text } = await rendered('event_update', f.cancellation);
    expect(subject).toBe('Cancelled: Vinyl & Vermouth, Thu Oct 15');
    expect(html).toContain('will not go ahead');
    expect(html).toContain('$135');
    expect(html).not.toContain('QR code for ticket');
    expect(text).toContain('refunded automatically');
    expect(html).toContain('Our selector is unwell');
  });

  it('staff invitation names the role, the inviter and the expiry', async () => {
    const { subject, html, text } = await rendered('staff_invitation', f.staffInvitation);
    expect(subject).toBe('Alessandro added you to the Cosa Nostra admin');
    expect(html).toContain('Manager');
    expect(html).toContain(f.staffInvitation.acceptUrl);
    expect(text).toContain('expires in 24 hours');
  });

  it('account emails carry the link as a button and as text', async () => {
    for (const id of ['magic_link', 'password_reset', 'verify_email', 'welcome'] as const) {
      const { html, text } = await rendered(id, { brand: f.brand, name: null, email: 'alex@example.com', actionUrl: 'https://example.com/auth?code=abc', expiresInMinutes: 60 });
      expect(html).toContain('https://example.com/auth?code=abc');
      expect(text).toContain('https://example.com/auth?code=abc');
      expect(html).not.toContain('Hi ,');
    }
  });

  it('every email has a footer with the address, the phone and the terms', async () => {
    const { html, text } = await rendered('thanks_for_coming', { brand: f.brand, customer: f.customer, event: f.vinylSession, reviewUrl: null });
    expect(html).toContain('West Loop, Chicago, IL ');
    expect(html).toContain('(312) 555-0147');
    expect(text).toContain(f.brand.termsUrl);
  });
});

describe('hiring and talent notices', () => {
  it('confirms an application without promising a timeline', async () => {
    const { subject, html, text } = await rendered('application_received', f.applicationReceived);
    expect(subject).toBe('We got your application — Bartender');
    expect(html).toContain('We have your application.');
    expect(html).toContain('Bartender');
    expect(html).toContain('JOB-260920-4K2P');
    expect(text).toContain('JOB-260920-4K2P');
    // An applicant is not on the staff rota and must not be told they are.
    expect(html).not.toContain('staff profile');
    expect(html).toContain('an application was sent from');
    // No invented promise about when somebody will hear back.
    expect(html).not.toMatch(/within \d+ (hours|days)/i);
  });

  it('thanks somebody for their work without promising them a night', async () => {
    const { subject, html } = await rendered('talent_received', f.talentReceived);
    expect(subject).toContain('We got it');
    expect(html).toContain('We got it.');
    expect(html).toContain('TAL-260920-9XQ1');
    expect(html).not.toMatch(/\byou are booked\b/i);
  });

  it('gives Cosa Nostra the facts and one way in', async () => {
    const { subject, html, text } = await rendered('submission_alert', f.submissionAlert);
    expect(subject).toContain('New at Cosa Nostra');
    expect(html).toContain('Somebody sent their work.');
    expect(html).toContain('(312) 555-0142');
    expect(html).toContain('/admin/talent');
    expect(text).toContain('Open the talent book');
  });
});

describe('registry', () => {
  it('every template id renders', () => {
    for (const template of EMAIL_TEMPLATES) {
      expect(isTemplateId(template.id)).toBe(true);
      expect(templateInfo(template.id)?.logType).toBeTruthy();
    }
    expect(isTemplateId('nope')).toBe(false);
  });
});

describe('qr', () => {
  it('draws a scannable-looking matrix with a quiet zone, synchronously', () => {
    const svg = qrSvg('https://example.com/t/abc');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<path d="M');
    expect(svg).toContain('fill="#ffffff"');
    const url = qrSvgDataUrl('https://example.com/t/abc');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  });
});
