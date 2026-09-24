import { SITE_URL } from '@/lib/site-url';
import { qrSvgDataUrl } from './utils/qr';
import type {
  EmailBrand,
  EmailCustomer,
  EmailEvent,
  EmailOrder,
  EmailTicket,
  EventUpdateProps,
  RefundConfirmationProps,
  StaffInvitationProps,
  TicketConfirmationProps,
  StaffEmailProps,
} from './types';



/** Where preview images load from. The live deployment, so the flyers really show. */
export const PREVIEW_ORIGIN = SITE_URL;

export const brand: EmailBrand = {
  name: 'Casa Aurelia',
  shortName: 'Casa Aurelia',
  siteUrl: PREVIEW_ORIGIN,
  logoUrl: `${PREVIEW_ORIGIN}/media/brandLogo.webp`,
  phone: '(312) 555-0147',
  supportEmail: 'tickets@example.invalid',
  eventsUrl: `${PREVIEW_ORIGIN}/events`,
  termsUrl: `${PREVIEW_ORIGIN}/legal/tickets`,
  instagramUrl: `${PREVIEW_ORIGIN}/contact`,
};

const venue = {
  name: 'Casa Aurelia',
  address: 'West Loop, Chicago, IL ',
  directionsUrl: `${PREVIEW_ORIGIN}/contact`,
};

export const vinylSession: EmailEvent = {
  id: 'evt_vinyl',
  title: 'Vinyl & Vermouth',
  summary: 'Records spinning. Martinis cold. Dinner optional.',
  startsAt: '2026-10-16T01:00:00.000Z', // Thu Oct 15, 8pm Chicago
  endsAt: '2026-10-16T04:00:00.000Z',
  doorsAt: '2026-10-16T00:30:00.000Z',
  venue,
  artworkUrl: `${PREVIEW_ORIGIN}/events/vinyl-vermouth-tall.webp`,
  artworkWidth: 900,
  artworkHeight: 1125,
  accentColor: '#b3241a',
  arrivalNote: 'Doors at 7:30. Your aperitivo is included — just bring yourself. Seats are first come, first served.',
  agePolicy: '21+',
  refundPolicy: 'Tickets are non-refundable within 48 hours of the event. Before that, email us and we will make it right.',
  eventUrl: `${PREVIEW_ORIGIN}/events/vinyl-vermouth`,
  status: 'scheduled',
};

export const sundayClubSession: EmailEvent = {
  ...vinylSession,
  id: 'evt_sunday-club',
  title: 'Sunday Supper',
  summary: 'Four family-style courses. One long, lovely evening.',
  startsAt: '2026-11-08T23:00:00.000Z', // Sun Nov 8, 5pm Chicago
  endsAt: '2026-11-09T03:00:00.000Z',
  doorsAt: null,
  artworkUrl: `${PREVIEW_ORIGIN}/events/sunday-supper-tall.webp`,
  artworkWidth: 900,
  artworkHeight: 1125,
  accentColor: '#c8862b',
  arrivalNote: null,
  agePolicy: 'all_ages',
  eventUrl: `${PREVIEW_ORIGIN}/events/sunday-supper`,
};

export const longTitleEvent: EmailEvent = {
  ...sundayClubSession,
  id: 'evt_long',
  title: 'The Long Italian Weekend: Aperitivo, Live Soul Records & a Midnight Supper with the House Selectors',
  artworkUrl: `${PREVIEW_ORIGIN}/events/sunday-supper-tall.webp`,
  artworkWidth: 900,
  artworkHeight: 1125,
  venue: { ...venue, name: 'Casa Aurelia — The Private Dining Room' },
  agePolicy: '18+',
};

export const noArtworkEvent: EmailEvent = {
  ...vinylSession,
  id: 'evt_noart',
  title: 'Soul Sessions with the House Trio',
  summary: null,
  artworkUrl: null,
  artworkWidth: null,
  artworkHeight: null,
  accentColor: null,
  arrivalNote: null,
  eventUrl: `${PREVIEW_ORIGIN}/events/vinyl-vermouth`,
};

export const cancelledEvent: EmailEvent = { ...vinylSession, status: 'cancelled' };

export const customer: EmailCustomer = { email: 'maria@example.com', firstName: 'Jamie', fullName: 'Jamie Morgan' };
export const anonymousCustomer: EmailCustomer = { email: 'guest@example.com', firstName: null, fullName: null };

function ticket(index: number, tierName: string, seats = 1, status: EmailTicket['status'] = 'valid'): EmailTicket {
  const code = ['7KX4-9QZM', 'B2NR-T8HD', 'M4JC-5VWP', 'Q9DF-2LKA', 'Z6HT-8NMB'][index] ?? `TK${index}0-AB${index}C`;
  const ticketUrl = `${PREVIEW_ORIGIN}/t/t1.preview${index}.sig`;
  return {
    id: `ticket_${index}`,
    code,
    tierName,
    seats,
    status,
    attendeeName: null,
    qrSrc: qrSvgDataUrl(ticketUrl),
    ticketUrl,
  };
}

function order(orderNumber: string, items: EmailOrder['items'], totalCents: number, extra: Partial<EmailOrder> = {}): EmailOrder {
  return {
    orderNumber,
    items,
    subtotalCents: items.reduce((sum, item) => sum + item.subtotalCents, 0),
    serviceFeeCents: 0,
    taxCents: 0,
    discountCents: 0,
    totalCents,
    refundedCents: 0,
    paidAt: '2026-10-02T19:14:00.000Z',
    ticketsUrl: `${PREVIEW_ORIGIN}/tickets/${orderNumber}?t=o1.preview.sig`,
    paymentMethod: 'Visa ending 4242',
    ...extra,
  };
}

export const singleTicketOrder = order('CNS-7KX49', [{ tierName: 'Supper Club Admission', quantity: 1, unitPriceCents: 4500, subtotalCents: 4500 }], 4500);
export const singleTicket: EmailTicket[] = [ticket(0, 'Supper Club Admission')];

export const threeTicketOrder = order('CNS-B2NRT', [{ tierName: 'Supper Club Admission', quantity: 3, unitPriceCents: 4500, subtotalCents: 13500 }], 13500);
export const threeTickets: EmailTicket[] = [ticket(0, 'Supper Club Admission'), ticket(1, 'Supper Club Admission'), ticket(2, 'Supper Club Admission')];

export const multiTierOrder = order(
  'CNS-M4JC5',
  [
    { tierName: 'Supper Club Admission', quantity: 2, unitPriceCents: 4500, subtotalCents: 9000 },
    { tierName: 'Table of 4 (VIP)', quantity: 1, unitPriceCents: 16000, subtotalCents: 16000 },
    { tierName: 'Just Watching', quantity: 2, unitPriceCents: 1500, subtotalCents: 3000 },
  ],
  28000,
  { discountCents: 2000, subtotalCents: 30000, serviceFeeCents: 0, taxCents: 0, paymentMethod: 'Apple Pay · Visa ending 0091' },
);
export const multiTierTickets: EmailTicket[] = [
  ticket(0, 'Supper Club Admission'),
  ticket(1, 'Supper Club Admission'),
  ticket(2, 'Table of 4 (VIP)', 4),
  ticket(3, 'Just Watching'),
  ticket(4, 'Just Watching'),
];

export const itemizedOrder = order(
  'CNS-Q9DF2',
  [{ tierName: 'Supper Club Admission', quantity: 2, unitPriceCents: 4500, subtotalCents: 9000 }],
  9876,
  { serviceFeeCents: 540, taxCents: 336, subtotalCents: 9000 },
);

export const ticketConfirmation: TicketConfirmationProps = {
  brand,
  customer,
  event: vinylSession,
  order: threeTicketOrder,
  tickets: threeTickets,
};

export const refund: RefundConfirmationProps = {
  brand,
  customer,
  event: vinylSession,
  order: { ...threeTicketOrder, refundedCents: 13500 },
  refundCents: 13500,
  tickets: threeTickets.map((entry) => ({ ...entry, status: 'refunded' as const, qrSrc: null })),
  full: true,
  status: 'processing',
  reason: null,
};

export const partialRefund: RefundConfirmationProps = {
  ...refund,
  order: { ...multiTierOrder, refundedCents: 4500 },
  refundCents: 4500,
  tickets: [{ ...multiTierTickets[1]!, status: 'refunded', qrSrc: null }],
  full: false,
  status: 'completed',
  reason: 'One guest could not make it — refunded at the register.',
};

export const cancellation: EventUpdateProps = {
  brand,
  customer,
  event: cancelledEvent,
  order: threeTicketOrder,
  tickets: threeTickets.map((entry) => ({ ...entry, status: 'void' as const, qrSrc: null })),
  kind: 'cancelled',
  previous: null,
  message: 'Our selector is unwell and we could not find a replacement in time. We are sorry — the next listening night is already on the calendar and we would love to see you there.',
  refundCents: 13500,
};

export const timeChange: EventUpdateProps = {
  brand,
  customer,
  event: { ...vinylSession, startsAt: '2026-10-16T02:00:00.000Z', endsAt: '2026-10-16T05:00:00.000Z', doorsAt: '2026-10-16T01:30:00.000Z' },
  order: threeTicketOrder,
  tickets: threeTickets,
  kind: 'time_change',
  previous: { startsAt: vinylSession.startsAt, endsAt: vinylSession.endsAt, doorsAt: vinylSession.doorsAt },
  message: 'The kitchen is fully booked for a private party until 8:30, so we are starting an hour later. Your tickets are unchanged.',
  refundCents: null,
};

export const dateChange: EventUpdateProps = {
  ...timeChange,
  event: { ...vinylSession, startsAt: '2026-10-24T00:00:00.000Z', endsAt: '2026-10-24T03:00:00.000Z', doorsAt: '2026-10-23T23:30:00.000Z' },
  kind: 'date_change',
  previous: { startsAt: vinylSession.startsAt, endsAt: vinylSession.endsAt },
  message: null,
};

export const postponed: EventUpdateProps = {
  ...timeChange,
  event: { ...vinylSession, status: 'postponed' },
  kind: 'postponed',
  previous: null,
  message: 'We are moving this night to November. Your tickets carry over automatically; if the new date does not work, reply and we will refund you.',
};

export const staffInvitation: StaffInvitationProps = {
  brand,
  name: 'Nico Moretti',
  email: 'alex@example.com',
  role: 'Manager',
  invitedBy: 'Alessandro',
  acceptUrl: `${PREVIEW_ORIGIN}/auth/activate#preview`,
  expiresInHours: 24,
};

/* ---------------------------------------------------------- staff operations */

const staffBase = {
  brand,
  name: 'Marco Bellini',
  email: 'carlos@example.com',
};

export const staffWelcome: StaffEmailProps = {
  ...staffBase,
  headline: 'Welcome to Casa Aurelia, Carlos.',
  intro: 'Alex added you to the Casa Aurelia team as a Bartender at Casa Aurelia Chicago. Everything you need for work — your schedule, training, tasks and documents — is in the Casa Aurelia staff app.',
  details: [
    { label: 'Position', value: 'Bartender' },
    { label: 'Location', value: 'Casa Aurelia Chicago' },
    { label: 'Start date', value: 'Friday, October 2' },
  ],
  note: 'Finish your onboarding checklist before your first shift. It takes about twenty minutes.',
  actionUrl: `${PREVIEW_ORIGIN}/staff/onboarding`,
  actionLabel: 'Start onboarding',
};

export const schedulePublished: StaffEmailProps = {
  ...staffBase,
  headline: 'Your schedule for Sep 28 – Oct 4 is out.',
  intro: 'Three shifts this week at Casa Aurelia Chicago.',
  details: [
    { label: 'Fri Oct 2', value: '5:00 PM – Close · Bartender' },
    { label: 'Sat Oct 3', value: '8:30 PM – 2:30 AM · Bartender · After Hours Saturday' },
    { label: 'Sun Oct 4', value: '4:00 PM – 10:00 PM · Bartender · Vinyl & Vermouth' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/staff/schedule`,
  actionLabel: 'Open my schedule',
};

export const shiftChanged: StaffEmailProps = {
  ...staffBase,
  headline: 'Your Saturday shift moved.',
  intro: 'A manager changed one of your published shifts.',
  details: [
    { label: 'Was', value: 'Sat Oct 3 · 8:30 PM – 2:30 AM · Bartender' },
    { label: 'Now', value: 'Sat Oct 3 · 7:00 PM – 2:30 AM · Bartender' },
    { label: 'Location', value: 'Casa Aurelia Chicago' },
  ],
  note: 'Doors open earlier for After Hours Saturday this week. Thanks for coming in early.',
  actionUrl: `${PREVIEW_ORIGIN}/staff/schedule`,
  actionLabel: 'See the shift',
};

export const timeOffDecision: StaffEmailProps = {
  ...staffBase,
  headline: 'Your time off is approved.',
  intro: 'Alex approved your request. It is on the schedule, and you will not be scheduled for those days.',
  details: [
    { label: 'Dates', value: 'Wed Oct 14 – Thu Oct 15' },
    { label: 'Decided by', value: 'Alex' },
  ],
  note: 'Enjoy it.',
  actionUrl: `${PREVIEW_ORIGIN}/staff/time-off`,
  actionLabel: 'View my requests',
};

export const trainingRequired: StaffEmailProps = {
  ...staffBase,
  headline: 'New training: Door & QR scanner.',
  intro: 'A required module was assigned to you. It takes about 15 minutes and ends with a short quiz.',
  details: [
    { label: 'Module', value: 'Door & QR scanner' },
    { label: 'Due', value: 'Friday, October 9' },
    { label: 'Passing score', value: '80%' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/staff/training`,
  actionLabel: 'Start training',
};

export const documentExpiring: StaffEmailProps = {
  ...staffBase,
  headline: 'Your BASSET card expires soon.',
  intro: 'Upload the renewed card before it expires so you stay cleared to work the bar.',
  details: [
    { label: 'Document', value: 'BASSET / alcohol service' },
    { label: 'Expires', value: 'Friday, October 30' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/staff/documents`,
  actionLabel: 'Upload the new card',
};

export const eventAssignment: StaffEmailProps = {
  ...staffBase,
  headline: 'You are working Vinyl & Vermouth.',
  intro: 'Alex put you on the door for Sunday’s event.',
  details: [
    { label: 'Event', value: 'Vinyl & Vermouth' },
    { label: 'When', value: 'Sun Oct 4 · 5:00 PM – 10:00 PM' },
    { label: 'Role', value: 'Door' },
    { label: 'Doors', value: '6:00 PM' },
  ],
  note: 'Scanner phones are charging at the host stand. Wristbands are in the office.',
  actionUrl: `${PREVIEW_ORIGIN}/staff/schedule`,
  actionLabel: 'See the night',
};

/* ------------------------------------------------------- hiring and talent */

export const applicationReceived: StaffEmailProps = {
  brand,
  name: 'Isabella Reed',
  email: 'isabella@example.com',
  headline: 'We have your application.',
  intro:
    'Thanks for putting your name in. Somebody at Casa Aurelia reads every one of these, and we will get in touch if it looks like a fit. If you would rather talk to a person, call us on (312) 555-0147.',
  details: [
    { label: 'Applied for', value: 'Bartender' },
    { label: 'Reference', value: 'JOB-260920-4K2P' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/events`,
  actionLabel: 'See what is on at Casa Aurelia',
  footerReason: 'Sent to isabella@example.com because an application was sent from the Casa Aurelia website.',
};

export const talentReceived: StaffEmailProps = {
  brand,
  name: 'Enzo Vale',
  email: 'enzo@example.com',
  headline: 'We got it.',
  intro:
    'Thanks for showing us what you do. We will have a proper look and reach out if something feels like a fit — a night, a wall, a set, whatever suits. No news does not mean no: we keep everybody on this list.',
  details: [
    { label: 'You sent', value: 'Soul, disco, Italian classics and tasteful house.' },
    { label: 'Reference', value: 'TAL-260920-9XQ1' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/events`,
  actionLabel: 'See what is on at Casa Aurelia',
  footerReason: 'Sent to enzo@example.com because you sent your work through the Casa Aurelia website.',
};

export const submissionAlert: StaffEmailProps = {
  brand,
  name: null,
  email: 'owner@example.com',
  headline: 'Somebody sent their work.',
  intro: 'Enzo Vale — soul, disco and Italian records',
  details: [
    { label: 'Does', value: 'Soul, disco, Italian classics and tasteful house.' },
    { label: 'Books as', value: 'dj' },
    { label: 'Reach them', value: '(312) 555-0142 · enzo@example.com' },
    { label: 'Links', value: '/contact' },
    { label: 'Photos', value: '2 attached' },
  ],
  note: null,
  actionUrl: `${PREVIEW_ORIGIN}/admin/talent`,
  actionLabel: 'Open the talent book',
  footerReason: 'Sent to the Casa Aurelia alert address. Turn it off in Emails.',
};
