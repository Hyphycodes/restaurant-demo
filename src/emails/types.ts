/**
 * What an email is given to render.
 *
 * These are the templates' whole world: no database, no Stripe, no Next.js.
 * The server maps its records into these shapes (`src/server/email/data.ts`)
 * and the previews supply fixtures of the same shapes, which is what keeps a
 * preview honest — it renders exactly what production would.
 *
 * Every optional field is a real production case: a guest who typed no name,
 * an event that has no artwork yet, a tier with more than one seat.
 */

export interface EmailBrand {
  name: string;
  shortName: string;
  /** Absolute origin, no trailing slash. */
  siteUrl: string;
  /** Absolute URL of the wordmark, or null for a text wordmark. */
  logoUrl: string | null;
  phone: string;
  /** Where a reply or a question goes. Null: the email says to call instead. */
  supportEmail: string | null;
  eventsUrl: string;
  termsUrl: string;
  instagramUrl: string | null;
}

export interface EmailVenue {
  name: string;
  
  address: string;
  directionsUrl: string;
}

export type EmailEventStatus = 'scheduled' | 'sold-out' | 'cancelled' | 'postponed' | 'free';

export interface EmailEvent {
  id: string;
  title: string;
  summary: string | null;
  /** ISO instants. Rendered in the venue's zone. */
  startsAt: string;
  endsAt: string;
  doorsAt: string | null;
  venue: EmailVenue;
  /** Absolute URL of the flyer, or null. The templates have a fallback. */
  artworkUrl: string | null;
  artworkWidth: number | null;
  artworkHeight: number | null;
  /** `#rrggbb` pulled from the flyer on upload, when there is one. */
  accentColor: string | null;
  /** What the guest should know on arrival. One or two sentences. */
  arrivalNote: string | null;
  agePolicy: 'all_ages' | '18+' | '21+' | null;
  refundPolicy: string | null;
  eventUrl: string;
  status: EmailEventStatus;
}

export type EmailTicketStatus = 'valid' | 'checked_in' | 'void' | 'refunded';

export interface EmailTicket {
  id: string;
  /** The human code, `ABCD-EFGH`. Shown as text under the QR and in the plain-text part. */
  code: string;
  tierName: string;
  seats: number;
  status: EmailTicketStatus;
  attendeeName: string | null;
  /**
   * What the `<img>` for the QR points at: `cid:qr1` when sent (an inline
   * attachment, so it shows when remote images are blocked), a data URL in
   * previews, or null when this ticket has no QR to show.
   */
  qrSrc: string | null;
  /** The ticket's own page, which is also what the QR encodes. */
  ticketUrl: string;
}

export interface EmailOrderItem {
  tierName: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface EmailOrder {
  orderNumber: string;
  items: EmailOrderItem[];
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  refundedCents: number;
  paidAt: string | null;
  /** The signed, 30-day tickets page for the whole order. */
  ticketsUrl: string;
  /** "Visa ending 4242" when known. */
  paymentMethod: string | null;
}

export interface EmailCustomer {
  email: string;
  firstName: string | null;
  fullName: string | null;
}

/** The three ticket-confirmation directions. Same data, three compositions. */
export type TicketDirection = 'editorial' | 'pass' | 'poster';

export interface TicketConfirmationProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  event: EmailEvent;
  order: EmailOrder;
  tickets: EmailTicket[];
  direction?: TicketDirection;
  /** A staff test send: banner at the top, "[TEST]" in the subject. */
  test?: boolean;
}

export interface EventReminderProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  event: EmailEvent;
  order: EmailOrder;
  tickets: EmailTicket[];
  /** `tomorrow` (about a day out) or `tonight` (hours out). */
  timing: 'tomorrow' | 'tonight';
  test?: boolean;
}

export interface TicketResendProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  event: EmailEvent;
  order: EmailOrder;
  tickets: EmailTicket[];
  test?: boolean;
}

export interface RefundConfirmationProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  event: EmailEvent;
  order: EmailOrder;
  /** The amount going back, in cents. */
  refundCents: number;
  /** Which tickets this refund covers. Empty when the whole order is refunded. */
  tickets: EmailTicket[];
  /** Whether every ticket on the order is now cancelled. */
  full: boolean;
  /** `processing` (Stripe has it) or `completed` (given back at the register). */
  status: 'processing' | 'completed';
  /** Why, in one line, when there is a reason worth saying. */
  reason: string | null;
  test?: boolean;
}

export type EventUpdateKind = 'time_change' | 'date_change' | 'venue_change' | 'info' | 'postponed' | 'cancelled';

export interface EventUpdateProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  /** The event as it now stands. */
  event: EmailEvent;
  order: EmailOrder | null;
  tickets: EmailTicket[];
  kind: EventUpdateKind;
  /** What it was, for a change. Only the fields that changed are set. */
  previous: { startsAt?: string; endsAt?: string; doorsAt?: string | null; venue?: EmailVenue } | null;
  /** The staff's own words, optional. Plain text; line breaks respected. */
  message: string | null;
  /** For a cancellation: whether a refund is on its way automatically. */
  refundCents: number | null;
  test?: boolean;
}

export type StaffRoleLabel = 'Owner' | 'Manager' | 'Contributor';

export interface StaffInvitationProps {
  brand: EmailBrand;
  /** Who is being invited. Null when only an address is known. */
  name: string | null;
  email: string;
  role: StaffRoleLabel | null;
  /** Who sent it, for the line "Alessandro added you". */
  invitedBy: string | null;
  acceptUrl: string;
  /** Hours until the link stops working. */
  expiresInHours: number | null;
  test?: boolean;
}

export interface AccountEmailProps {
  brand: EmailBrand;
  name: string | null;
  email: string;
  /** The link that does the thing. */
  actionUrl: string;
  /** Minutes until it stops working, when known. */
  expiresInMinutes: number | null;
  test?: boolean;
}

/**
 * The notice shape: a headline, a sentence, a few labelled details, an
 * optional note in somebody's own words, and one button.
 *
 * Seven staff operations emails use it (src/emails/templates/staff), and so do
 * the three hiring and talent notices, which is why `footerReason` exists —
 * an applicant is not on the staff rota and must not be told they are.
 */
export interface StaffEmailProps {
  brand: EmailBrand;
  name: string | null;
  email: string;
  headline: string;
  intro: string;
  details: { label: string; value: string }[];
  /** A manager's note, plain text, line breaks respected. */
  note: string | null;
  actionUrl: string;
  actionLabel: string;
  /** Why this person is receiving it. Staff emails leave it unset. */
  footerReason?: string;
  test?: boolean;
}

/** What every template produces, with the subject and plain text beside the HTML. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
