/**
 * Every email the system knows how to send, as data.
 *
 * The admin's Communications screen, the preview route and the delivery
 * log all read this one list, so adding an email is: a template, a line
 * here, and a method on the service. Nothing else has to learn about it.
 *
 * `logType` is what lands in `email_log.type`. `trigger` is the honest
 * state of the wiring — a template that exists but nothing sends yet says
 * so here, where the owner can see it, rather than looking finished.
 *
 * `EMAIL_SWITCHES`, below, is the short list of emails the owner may turn
 * on and off from the admin. Everything not on that list has no switch on
 * purpose: a ticket, a refund, an event change and a sign-in link are owed
 * to somebody, so the code never offers to withhold them.
 */

export type TemplateId =
  | 'ticket_confirmation'
  | 'event_reminder'
  | 'ticket_resend'
  | 'refund_confirmation'
  | 'event_update'
  | 'thanks_for_coming'
  | 'staff_invitation'
  | 'magic_link'
  | 'password_reset'
  | 'verify_email'
  | 'welcome'
  | 'staff_welcome'
  | 'schedule_published'
  | 'shift_changed'
  | 'time_off_decision'
  | 'training_required'
  | 'document_expiring'
  | 'event_assignment'
  | 'application_received'
  | 'talent_received'
  | 'submission_alert';

export type EmailLogType =
  | 'confirmation'
  | 'reminder'
  | 'tonight'
  | 'resend'
  | 'refund'
  | 'event_update'
  | 'cancellation'
  | 'thanks'
  | 'staff_invitation'
  | 'magic_link'
  | 'password_reset'
  | 'verify_email'
  | 'welcome'
  | 'owner_alert'
  | 'staff_welcome'
  | 'schedule_published'
  | 'shift_changed'
  | 'time_off_decision'
  | 'training_required'
  | 'document_expiring'
  | 'event_assignment'
  | 'application_received'
  | 'talent_received'
  | 'submission_alert';

export type EmailCategory = 'transactional' | 'account' | 'staff';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  /** One sentence, for the admin list. */
  description: string;
  category: EmailCategory;
  logType: EmailLogType;
  /** Needs a real event to preview and to send a test. */
  needsEvent: boolean;
  /** What actually causes a send, in plain words. */
  trigger: string;
  /** `live` = wired to a real trigger; `manual` = a staff action; `template` = built, nothing sends it yet. */
  wiring: 'live' | 'manual' | 'template' | 'off';
  /** Preview variants the admin can pick. */
  variants?: { id: string; label: string }[];
}

export const TICKET_DIRECTIONS = [
  { id: 'pass', label: 'B · Digital pass (default)' },
  { id: 'editorial', label: 'A · Editorial' },
  { id: 'poster', label: 'C · Poster' },
] as const;

export const EMAIL_TEMPLATES: TemplateInfo[] = [
  {
    id: 'ticket_confirmation',
    name: 'Ticket confirmation',
    description: 'The tickets, with a QR each, sent the moment a payment is confirmed.',
    category: 'transactional',
    logType: 'confirmation',
    needsEvent: true,
    trigger: 'Stripe webhook, once payment_intent.succeeded is verified server-side; also a free (promo) order the moment it is reserved.',
    wiring: 'live',
    variants: [...TICKET_DIRECTIONS],
  },
  {
    id: 'event_reminder',
    name: 'Event reminder',
    description: '“Tomorrow at Casa Aurelia”: the night, the door details, the tickets again.',
    category: 'transactional',
    logType: 'reminder',
    needsEvent: true,
    trigger: 'Hourly cron, 23–25 hours before the event starts, once per order. A second “tonight” pass, a few hours before doors, has its own switch and ships off.',
    wiring: 'live',
    variants: [
      { id: 'tomorrow', label: 'Tomorrow' },
      { id: 'tonight', label: 'Tonight' },
    ],
  },
  {
    id: 'ticket_resend',
    name: 'Ticket resend',
    description: 'The tickets again, and nothing else, for someone who asked.',
    category: 'transactional',
    logType: 'resend',
    needsEvent: true,
    trigger: '“Email these to me again” on the tickets page, or Resend tickets on an order in Sales. Three per order per ten minutes.',
    wiring: 'live',
  },
  {
    id: 'refund_confirmation',
    name: 'Refund confirmation',
    description: 'The amount, where it is going, and which tickets stop working.',
    category: 'transactional',
    logType: 'refund',
    needsEvent: true,
    trigger: 'Stripe webhook on charge.refunded (full or partial), and a register refund marked in Sales.',
    wiring: 'live',
    variants: [
      { id: 'full', label: 'Whole order' },
      { id: 'partial', label: 'Some tickets' },
    ],
  },
  {
    id: 'event_update',
    name: 'Event update / cancellation',
    description: 'A time, date or venue change, a postponement, or a cancellation, with the change first.',
    category: 'transactional',
    logType: 'event_update',
    needsEvent: true,
    trigger: 'Cancel event in the editor emails every ticket holder automatically. Other changes are sent from this screen, to one event’s ticket holders, on purpose.',
    wiring: 'live',
    variants: [
      { id: 'cancelled', label: 'Cancelled' },
      { id: 'time_change', label: 'Time change' },
      { id: 'date_change', label: 'Date change' },
      { id: 'venue_change', label: 'Venue change' },
      { id: 'postponed', label: 'Postponed' },
      { id: 'info', label: 'Information update' },
    ],
  },
  {
    id: 'thanks_for_coming',
    name: 'Thanks for coming',
    description: 'The morning after. One thank you, one link to what is on next.',
    category: 'transactional',
    logType: 'thanks',
    needsEvent: true,
    trigger: 'The hourly cron, the morning after an event, once per order — when the switch on this screen is on. It ships off.',
    wiring: 'live',
  },
  {
    id: 'staff_invitation',
    name: 'Staff invitation',
    description: 'Welcome to the team, your role, one button to accept and sign in.',
    category: 'staff',
    logType: 'staff_invitation',
    needsEvent: false,
    trigger: 'Add a staff member in Team. Delivered through Supabase Auth: branded when the auth email hook points at this site, otherwise Supabase’s own template.',
    wiring: 'live',
  },
  {
    id: 'magic_link',
    name: 'Sign-in link',
    description: 'The passwordless sign-in link for staff.',
    category: 'account',
    logType: 'magic_link',
    needsEvent: false,
    trigger: '“Email me a sign-in link” on the staff sign-in page, through the Supabase auth email hook.',
    wiring: 'live',
  },
  {
    id: 'password_reset',
    name: 'Password reset',
    description: 'Choose a new password, for the password fallback.',
    category: 'account',
    logType: 'password_reset',
    needsEvent: false,
    trigger: 'A password reset requested through Supabase Auth, through the auth email hook.',
    wiring: 'live',
  },
  {
    id: 'verify_email',
    name: 'Verify email',
    description: 'Confirm an address for a new account or a changed email.',
    category: 'account',
    logType: 'verify_email',
    needsEvent: false,
    trigger: 'A signup or email change in Supabase Auth, through the auth email hook.',
    wiring: 'live',
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Your account is ready. Held for the day guests have accounts.',
    category: 'account',
    logType: 'welcome',
    needsEvent: false,
    trigger: 'Nothing yet — there are no customer accounts. Template only.',
    wiring: 'template',
  },
];

const STAFF_OPS_TEMPLATES: TemplateInfo[] = [
  {
    id: 'staff_welcome',
    name: 'Welcome to the team',
    description: 'A new employee’s first email: what Casa Aurelia is, and the button into their onboarding checklist.',
    category: 'staff',
    logType: 'staff_welcome',
    needsEvent: false,
    trigger: 'A manager adds an employee in the staff app and sends the invitation.',
    wiring: 'live',
  },
  {
    id: 'schedule_published',
    name: 'Schedule published',
    description: 'Your shifts for the week, with one link to the schedule.',
    category: 'staff',
    logType: 'schedule_published',
    needsEvent: false,
    trigger: 'A manager publishes a week in the staff app. One email per employee with shifts in it.',
    wiring: 'live',
  },
  {
    id: 'shift_changed',
    name: 'Shift changed',
    description: 'A published shift moved, was reassigned or was cancelled.',
    category: 'staff',
    logType: 'shift_changed',
    needsEvent: false,
    trigger: 'A manager changes or cancels a published shift, or approves a coverage request.',
    wiring: 'live',
  },
  {
    id: 'time_off_decision',
    name: 'Time-off decision',
    description: 'Approved or denied, with the manager’s note.',
    category: 'staff',
    logType: 'time_off_decision',
    needsEvent: false,
    trigger: 'A manager decides a time-off request.',
    wiring: 'live',
  },
  {
    id: 'training_required',
    name: 'Training assigned',
    description: 'A new required training module, its due date, and a link straight into it.',
    category: 'staff',
    logType: 'training_required',
    needsEvent: false,
    trigger: 'A manager assigns a module, or a module is re-required after a new version.',
    wiring: 'live',
  },
  {
    id: 'document_expiring',
    name: 'Document expiring',
    description: 'A certificate is about to expire, with what to upload.',
    category: 'staff',
    logType: 'document_expiring',
    needsEvent: false,
    trigger: 'The hourly cron, once per document, thirty days before it expires.',
    wiring: 'live',
  },
  {
    id: 'event_assignment',
    name: 'Event assignment',
    description: 'You are working an event: the night, the role, the time.',
    category: 'staff',
    logType: 'event_assignment',
    needsEvent: false,
    trigger: 'A manager assigns someone to an event in the staffing section.',
    wiring: 'live',
  },
];


const PEOPLE_TEMPLATES: TemplateInfo[] = [
  {
    id: 'application_received',
    name: 'Application received',
    description: 'To somebody who applied for a job: we have it, and a person will read it.',
    category: 'transactional',
    logType: 'application_received',
    needsEvent: false,
    trigger: 'Somebody sends the form on /careers or /contact.',
    wiring: 'live',
  },
  {
    id: 'talent_received',
    name: 'Talent submission received',
    description: 'To a DJ, painter or performer who sent their work: we will look, and reach out if it fits.',
    category: 'transactional',
    logType: 'talent_received',
    needsEvent: false,
    trigger: 'Somebody sends the form on /talent or /contact.',
    wiring: 'live',
  },
  {
    id: 'submission_alert',
    name: 'Somebody wrote in',
    description: 'The internal nudge, to the alert address, when an application or a talent submission arrives.',
    category: 'staff',
    logType: 'submission_alert',
    needsEvent: false,
    trigger: 'Every application and talent submission, to OWNER_ALERT_EMAIL, while the switch on this screen is on.',
    wiring: 'live',
  },
];

EMAIL_TEMPLATES.push(...STAFF_OPS_TEMPLATES, ...PEOPLE_TEMPLATES);

/**
 * The emails the owner may switch on and off, and nothing else.
 *
 * An id here is a row in `email_settings`. Most are a template; the two
 * reminder passes are one template sent at two different times, so they get
 * a switch each — "tomorrow" is the one that has always been on and
 * "tonight" is the one nobody has asked for yet.
 *
 * Absence is the rule, not an oversight. A ticket confirmation, a resend, a
 * refund, an event change, a staff invitation and the four account emails
 * have no switch: they answer something a person did, and an owner who
 * wants them to stop wants a different setting (guest delivery, in the
 * environment) rather than a toggle that quietly drops receipts.
 */
export type EmailSwitchId =
  | 'event_reminder'
  | 'event_reminder_tonight'
  | 'thanks_for_coming'
  | 'staff_welcome'
  | 'schedule_published'
  | 'shift_changed'
  | 'time_off_decision'
  | 'training_required'
  | 'document_expiring'
  | 'event_assignment'
  | 'submission_alert';

export interface EmailSwitch {
  id: EmailSwitchId;
  template: TemplateId;
  /** Which version of the template this switch governs, where there are versions. */
  variant: string | null;
  /** What it is called on the switch itself. */
  label: string;
  /** What being on actually causes. One sentence. */
  detail: string;
  /** How it ships, and what a missing `email_settings` row means. */
  defaultOn: boolean;
}

export const EMAIL_SWITCHES: EmailSwitch[] = [
  {
    id: 'event_reminder',
    template: 'event_reminder',
    variant: 'tomorrow',
    label: 'The day before',
    detail: 'Every ticket holder is reminded 23–25 hours before doors.',
    defaultOn: true,
  },
  {
    id: 'event_reminder_tonight',
    template: 'event_reminder',
    variant: 'tonight',
    label: 'A few hours before doors',
    detail: 'A second reminder on the day itself. Off unless you want two.',
    defaultOn: false,
  },
  {
    id: 'thanks_for_coming',
    template: 'thanks_for_coming',
    variant: null,
    label: 'The morning after',
    detail: 'One thank you and a link to what is on next, 12–36 hours after the event.',
    defaultOn: false,
  },
  { id: 'staff_welcome', template: 'staff_welcome', variant: null, label: 'Welcome to the team', detail: 'A new employee is emailed their onboarding checklist.', defaultOn: true },
  { id: 'schedule_published', template: 'schedule_published', variant: null, label: 'Schedule published', detail: 'Everyone with shifts is emailed when a week is published.', defaultOn: true },
  { id: 'shift_changed', template: 'shift_changed', variant: null, label: 'Shift changed', detail: 'The employee is emailed when a published shift moves or is cancelled.', defaultOn: true },
  { id: 'time_off_decision', template: 'time_off_decision', variant: null, label: 'Time-off decision', detail: 'The employee is emailed when a request is approved or denied.', defaultOn: true },
  { id: 'training_required', template: 'training_required', variant: null, label: 'Training assigned', detail: 'The employee is emailed when a module is assigned or re-required.', defaultOn: true },
  { id: 'document_expiring', template: 'document_expiring', variant: null, label: 'Document expiring', detail: 'The employee is emailed thirty days before a certificate lapses.', defaultOn: true },
  { id: 'event_assignment', template: 'event_assignment', variant: null, label: 'Event assignment', detail: 'The employee is emailed when they are put on an event.', defaultOn: true },
  { id: 'submission_alert', template: 'submission_alert', variant: null, label: 'Somebody wrote in', detail: 'The alert address is emailed when a job application or a talent submission arrives.', defaultOn: true },
];

export const EMAIL_SWITCH_DEFAULTS: Record<EmailSwitchId, boolean> = Object.fromEntries(
  EMAIL_SWITCHES.map((entry) => [entry.id, entry.defaultOn]),
) as Record<EmailSwitchId, boolean>;

/** The switch governing one template, or one version of it. Null means there is none. */
export function switchFor(template: string, variant?: string | null): EmailSwitch | null {
  const candidates = EMAIL_SWITCHES.filter((entry) => entry.template === template);
  if (candidates.length === 0) return null;
  if (candidates.length === 1 && candidates[0]!.variant === null) return candidates[0]!;
  return candidates.find((entry) => entry.variant === (variant || candidates[0]!.variant)) ?? candidates[0]!;
}

export function isEmailSwitchId(value: string): value is EmailSwitchId {
  return EMAIL_SWITCHES.some((entry) => entry.id === value);
}

export function templateInfo(id: string): TemplateInfo | null {
  return EMAIL_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function isTemplateId(value: string): value is TemplateId {
  return EMAIL_TEMPLATES.some((template) => template.id === value);
}
