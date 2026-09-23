import { z } from 'zod';
import type { InquiryRecord, InquiryStatus, InquiryType } from '@/content/types';
import type { Row } from '@/lib/db/types';
import { venueIsoDate } from './events';

/**
 * The private-events & catering pipeline, as pure functions.
 *
 * Five stages and three light fields (next step, follow-up date, when it last
 * moved). Everything the board and the detail screen compute — which column a
 * card sits in, whether a follow-up is overdue, "2 days ago", the one-line
 * summary — lives here, so it can be tested without a database or a clock.
 *
 * Dates: `followUpOn` and the requested event date are venue-local calendar
 * days (YYYY-MM-DD). "Today" is always the venue's today, never the browser's.
 */

export const INQUIRY_STAGES = ['new', 'contacted', 'planning', 'booked', 'closed'] as const satisfies readonly InquiryStatus[];

export const INQUIRY_STAGE_LABEL: Record<InquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  planning: 'Planning',
  booked: 'Booked',
  closed: 'Closed',
};

/** One short sentence per stage, for the stepper and the column headers. */
export const INQUIRY_STAGE_HINT: Record<InquiryStatus, string> = {
  new: 'Waiting for a reply.',
  contacted: 'We have been in touch.',
  planning: 'Menu, room and numbers in progress.',
  booked: 'Date held, details agreed.',
  closed: 'Finished, or not going ahead.',
};

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  'private-event': 'Private event',
  catering: 'Catering',
  careers: 'Job application',
};

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === 'string' && (INQUIRY_STAGES as readonly string[]).includes(value);
}

/**
 * A stored status → a stage. 'in-progress' predates the pipeline (migration
 * 0027) and meant "somebody has replied", which is Contacted. Anything
 * unrecognised is treated as New, so it is looked at rather than lost.
 */
export function normalizeInquiryStatus(value: unknown): InquiryStatus {
  if (value === 'in-progress') return 'contacted';
  return isInquiryStatus(value) ? value : 'new';
}

/* ------------------------------------------------------------------ rows -- */

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isoDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function inquiryType(value: unknown): InquiryType {
  return value === 'catering' || value === 'careers' ? value : 'private-event';
}

/** A database row (Supabase or the demo overlay) → the record the admin draws. */
export function inquiryFromRow(row: Row): InquiryRecord {
  const createdAt = String(row.created_at ?? '');
  const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? (row.payload as InquiryRecord['payload'])
    : {};
  return {
    id: String(row.id),
    reference: String(row.reference ?? ''),
    type: inquiryType(row.type),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: text(row.phone),
    payload,
    status: normalizeInquiryStatus(row.status),
    notes: text(row.notes),
    nextStep: text(row.next_step),
    followUpOn: isoDay(row.follow_up_on),
    statusChangedAt: text(row.status_changed_at) ?? createdAt,
    createdAt,
  };
}

/* ------------------------------------------------------- the request ---- */

/** The day they asked for, if the form captured one. */
export function requestedDate(inquiry: InquiryRecord): string | null {
  return isoDay(inquiry.payload.date);
}

export function guestCount(inquiry: InquiryRecord): number | null {
  const value = Number(inquiry.payload.guests);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** What kind of occasion, in the guest's words when they gave one. */
export function occasionOf(inquiry: InquiryRecord): string {
  const { eventType, organization, packageInterest } = inquiry.payload;
  if (inquiry.type === 'private-event' && typeof eventType === 'string' && eventType) return eventType;
  if (inquiry.type === 'catering') {
    if (typeof organization === 'string' && organization) return organization;
    if (typeof packageInterest === 'string' && packageInterest) return packageInterest;
  }
  return INQUIRY_TYPE_LABEL[inquiry.type];
}

/** Their own words. Forms store it as `notes`; very early rows used `message`. */
export function messageOf(inquiry: InquiryRecord): string | null {
  return text(inquiry.payload.notes) ?? text(inquiry.payload.message);
}

/* ----------------------------------------------------------- follow-up -- */

export function venueToday(now: Date = new Date()): string {
  return venueIsoDate(now.toISOString());
}

/** A follow-up day that has passed on something still open. */
export function isFollowUpOverdue(inquiry: Pick<InquiryRecord, 'followUpOn' | 'status'>, today: string): boolean {
  return Boolean(inquiry.followUpOn) && inquiry.status !== 'closed' && inquiry.followUpOn! < today;
}

export function isFollowUpToday(inquiry: Pick<InquiryRecord, 'followUpOn' | 'status'>, today: string): boolean {
  return inquiry.status !== 'closed' && inquiry.followUpOn === today;
}

/* ------------------------------------------------------------- board ---- */

export type InquiryFilter = 'all' | 'private-event' | 'catering';

export const INQUIRY_FILTERS: { id: InquiryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'private-event', label: 'Private events' },
  { id: 'catering', label: 'Catering' },
];

export function parseInquiryFilter(value: unknown): InquiryFilter {
  return value === 'private-event' || value === 'catering' ? value : 'all';
}

export function filterInquiries<T extends Pick<InquiryRecord, 'type'>>(list: T[], filter: InquiryFilter): T[] {
  return filter === 'all' ? list : list.filter((entry) => entry.type === filter);
}

function compareNullableAsc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * Every stage, in board order, each with its cards in the order worth
 * reading them:
 *
 *   - open stages: soonest follow-up first (so overdue ones lead), then the
 *     newest enquiry;
 *   - Booked: the soonest event first — that is the one to prepare;
 *   - Closed: the most recently closed first.
 */
export function groupByStage(list: InquiryRecord[]): Record<InquiryStatus, InquiryRecord[]> {
  const groups = Object.fromEntries(INQUIRY_STAGES.map((stage) => [stage, [] as InquiryRecord[]])) as Record<
    InquiryStatus,
    InquiryRecord[]
  >;
  for (const inquiry of list) groups[normalizeInquiryStatus(inquiry.status)].push(inquiry);

  const newestFirst = (a: InquiryRecord, b: InquiryRecord) => b.createdAt.localeCompare(a.createdAt);
  for (const stage of INQUIRY_STAGES) {
    groups[stage].sort((a, b) => {
      if (stage === 'closed') return b.statusChangedAt.localeCompare(a.statusChangedAt);
      if (stage === 'booked') {
        return compareNullableAsc(requestedDate(a), requestedDate(b)) || newestFirst(a, b);
      }
      return compareNullableAsc(a.followUpOn, b.followUpOn) || newestFirst(a, b);
    });
  }
  return groups;
}

export interface PipelineSummary {
  counts: Record<InquiryStatus, number>;
  /** Moved to Booked during the current venue month. */
  bookedThisMonth: number;
  overdue: number;
  dueToday: number;
}

export function summarizePipeline(list: InquiryRecord[], now: Date = new Date()): PipelineSummary {
  const today = venueToday(now);
  const month = today.slice(0, 7);
  const counts = Object.fromEntries(INQUIRY_STAGES.map((stage) => [stage, 0])) as Record<InquiryStatus, number>;
  let bookedThisMonth = 0;
  let overdue = 0;
  let dueToday = 0;
  for (const inquiry of list) {
    counts[inquiry.status] += 1;
    if (
      inquiry.status === 'booked' &&
      inquiry.statusChangedAt &&
      Number.isFinite(Date.parse(inquiry.statusChangedAt)) &&
      venueIsoDate(inquiry.statusChangedAt).slice(0, 7) === month
    ) {
      bookedThisMonth += 1;
    }
    if (isFollowUpOverdue(inquiry, today)) overdue += 1;
    if (isFollowUpToday(inquiry, today)) dueToday += 1;
  }
  return { counts, bookedThisMonth, overdue, dueToday };
}

/** "3 new · 2 planning · 1 booked this month — 1 follow-up overdue". */
export function summaryLine(summary: PipelineSummary): string {
  const parts: string[] = [];
  if (summary.counts.new) parts.push(`${summary.counts.new} new`);
  if (summary.counts.contacted) parts.push(`${summary.counts.contacted} contacted`);
  if (summary.counts.planning) parts.push(`${summary.counts.planning} planning`);
  if (summary.bookedThisMonth) parts.push(`${summary.bookedThisMonth} booked this month`);
  const head = parts.length > 0 ? parts.join(' · ') : 'Nothing open';
  const tail: string[] = [];
  if (summary.overdue) tail.push(`${summary.overdue} follow-up${summary.overdue === 1 ? '' : 's'} overdue`);
  if (summary.dueToday) tail.push(`${summary.dueToday} due today`);
  return tail.length > 0 ? `${head} — ${tail.join(', ')}` : head;
}

/* ------------------------------------------------------------- dates ---- */

/** "just now", "3 hours ago", "yesterday", "2 days ago", "3 weeks ago". */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** A calendar day, "Sat, Nov 14" — or with the year when it is not this one. */
export function formatDay(day: string, today?: string, style: 'short' | 'long' = 'short'): string {
  const at = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(at)) return day;
  const sameYear = today ? today.slice(0, 4) === day.slice(0, 4) : true;
  return new Intl.DateTimeFormat('en-US', {
    weekday: style === 'long' ? 'long' : 'short',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: sameYear && style === 'short' ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(at);
}

/** An instant, in the venue's time: "Tue, Sep 22 · 4:05pm". */
export function formatMoment(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }).format(at);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    .format(at)
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
  return `${day} · ${time}`;
}

/** Whole days from `today` to `day` (negative when it has passed). */
export function daysBetween(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/* -------------------------------------------------------- validation ---- */

const calendarDay = z
  .string()
  .trim()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'Choose a valid date.',
  );

export const inquiryStatusSchema = z.object({
  id: z.string().trim().min(1).max(200),
  status: z.enum(INQUIRY_STAGES),
});

export const inquiryPlanSchema = z.object({
  id: z.string().trim().min(1).max(200),
  nextStep: z.string().trim().max(200, 'Keep the next step to one line (200 characters).'),
  followUpOn: z.union([z.literal(''), calendarDay]),
  notes: z.string().trim().max(2000, 'Notes can be up to 2,000 characters.'),
});
