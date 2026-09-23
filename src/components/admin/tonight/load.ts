import 'server-only';

import type { ShiftRequest, ShiftView, StaffAnnouncement, TimeOffRequest } from '@/content/staff-types';
import type { DayHours, ResolvedEvent, TemporaryClosure } from '@/content/types';
import type { Db, Row } from '@/lib/db/types';
import { formatMinutes } from '@/lib/format';
import { addDays, weekdayOf, zonedDate, zonedInstant } from '@/lib/staff/time';
import { listAllAnnouncements } from '@/server/staff/announcements';
import { listShiftRequests } from '@/server/staff/coverage';
import { listLocations } from '@/server/staff/locations';
import { listShiftViews } from '@/server/staff/schedule';
import { listTimeOff } from '@/server/staff/timeoff';
import { listOrders, type AdminOrder } from '@/server/ticketing/sales';

/**
 * The reads behind the admin's "Tonight" screen.
 *
 * Each one is independent and each one degrades to an empty answer rather
 * than taking the page down: an owner opening the admin at five o'clock
 * should see the room, even if the schedule table is having a bad day.
 */

/** Before this hour, "tonight" is still last night: the bar closes at 1:30. */
const SERVICE_DAY_STARTS_AT_HOUR = 5;

export async function safely<T>(work: Promise<T> | (() => Promise<T>), fallback: T): Promise<T> {
  try {
    return await (typeof work === 'function' ? work() : work);
  } catch (error) {
    console.error('[admin/tonight] a section could not load:', error);
    return fallback;
  }
}

/** The venue-local date a night belongs to, with the small hours counted as the night before. */
export function serviceDate(now: Date, timeZone: string): string {
  return zonedDate(new Date(now.getTime() - SERVICE_DAY_STARTS_AT_HOUR * 3_600_000), timeZone);
}

/* ------------------------------------------------------------------ room -- */

export interface RoomTonight {
  /** e.g. "4pm – 11pm", or null when closed. */
  hours: string | null;
  closedReason: string | null;
}

/** Tonight's opening hours in words, from the same records the public site reads. */
export function roomTonight(hours: DayHours[], closures: TemporaryClosure[], date: string): RoomTonight {
  const closure = closures.find((entry) => entry.date === date);
  if (closure) return { hours: null, closedReason: closure.reason };
  const day = hours.find((entry) => entry.day === weekdayOf(date));
  if (!day || day.closed || day.ranges.length === 0) return { hours: null, closedReason: null };
  return {
    hours: day.ranges.map((range) => `${formatMinutes(range.openMinutes)} – ${formatMinutes(range.closeMinutes)}`).join(', '),
    closedReason: null,
  };
}

/* ----------------------------------------------------------------- floor -- */

export interface FloorTonight {
  date: string;
  timeZone: string;
  /** People on published shifts tonight, in start order. */
  scheduled: ShiftView[];
  /** Published shifts nobody holds yet. */
  open: ShiftView[];
  /** Somebody on tonight has asked to be covered. */
  coverage: ShiftRequest[];
  /** When nobody is on tonight: the next night that has anyone, so the empty state still says something useful. */
  nextNight: { date: string; scheduled: ShiftView[]; open: ShiftView[] } | null;
}

function byStart(a: ShiftView, b: ShiftView): number {
  return a.startsAt.localeCompare(b.startsAt) || a.positionName.localeCompare(b.positionName);
}

export async function loadFloor(db: Db, now: Date, fallbackZone: string): Promise<FloorTonight> {
  const locations = await safely(listLocations(db), []);
  const timeZone = locations.find((location) => location.active)?.timezone ?? fallbackZone;
  const date = serviceDate(now, timeZone);
  const dayBounds = (day: string) => ({
    from: zonedInstant(day, SERVICE_DAY_STARTS_AT_HOUR * 60, timeZone),
    to: zonedInstant(addDays(day, 1), SERVICE_DAY_STARTS_AT_HOUR * 60, timeZone),
  });

  // Tonight, plus the week ahead in one read for the "next night" fallback.
  const tonight = dayBounds(date);
  const [shifts, requests] = await Promise.all([
    safely(listShiftViews(db, { from: tonight.from, to: dayBounds(addDays(date, 7)).to }), [] as ShiftView[]),
    safely(listShiftRequests(db, { status: ['open', 'claimed'] }), [] as ShiftRequest[]),
  ]);
  const inside = (shift: ShiftView, range: { from: string; to: string }) =>
    Date.parse(shift.startsAt) >= Date.parse(range.from) && Date.parse(shift.startsAt) < Date.parse(range.to);

  const tonightShifts = shifts.filter((shift) => inside(shift, tonight)).sort(byStart);
  const scheduled = tonightShifts.filter((shift) => shift.employeeId);
  const open = tonightShifts.filter((shift) => !shift.employeeId);
  const coverage = requests.filter((request) => inside(request.shift, tonight));

  let nextNight: FloorTonight['nextNight'] = null;
  if (tonightShifts.length === 0) {
    for (let offset = 1; offset <= 7 && !nextNight; offset += 1) {
      const day = addDays(date, offset);
      const those = shifts.filter((shift) => inside(shift, dayBounds(day))).sort(byStart);
      if (those.length > 0) {
        nextNight = { date: day, scheduled: those.filter((shift) => shift.employeeId), open: those.filter((shift) => !shift.employeeId) };
      }
    }
  }

  return { date, timeZone, scheduled, open, coverage, nextNight };
}

/* -------------------------------------------------------------- the team -- */

export interface TeamWaiting {
  coverage: ShiftRequest[];
  timeOff: TimeOffRequest[];
  /** Live announcements that ask to be acknowledged and have not been by everyone. */
  unacknowledged: StaffAnnouncement[];
}

export async function loadTeamWaiting(db: Db, now: Date): Promise<TeamWaiting> {
  const [coverage, timeOff, announcements] = await Promise.all([
    safely(listShiftRequests(db, { status: ['open', 'claimed'] }), [] as ShiftRequest[]),
    safely(listTimeOff(db, { status: 'pending' }), [] as TimeOffRequest[]),
    safely(listAllAnnouncements(db), [] as StaffAnnouncement[]),
  ]);
  const stamp = now.getTime();
  return {
    // A request for a shift that has already started is history, not a question.
    coverage: coverage.filter((request) => Date.parse(request.shift.startsAt) > stamp),
    timeOff,
    unacknowledged: announcements.filter(
      (announcement) =>
        announcement.requiresAck &&
        announcement.publishedAt !== null &&
        Date.parse(announcement.publishedAt) <= stamp &&
        (announcement.expiresAt === null || Date.parse(announcement.expiresAt) > stamp) &&
        (announcement.audience ?? 0) > 0 &&
        (announcement.acknowledged ?? 0) < (announcement.audience ?? 0),
    ),
  };
}

/* ------------------------------------------------------------- enquiries -- */

export interface EnquiryPreview {
  id: string;
  name: string;
  kind: string;
}

const ENQUIRY_KIND: Record<string, string> = {
  'private-event': 'private event',
  catering: 'catering',
  contact: 'message',
};

/** Who is waiting, in a few words each. Only reads fields every enquiry has. */
export function previewEnquiries(rows: Row[]): EnquiryPreview[] {
  return [...rows]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const guests = typeof payload.guests === 'number' ? payload.guests : null;
      const label = typeof payload.eventType === 'string' && payload.eventType ? payload.eventType.toLowerCase() : (ENQUIRY_KIND[String(row.type)] ?? 'enquiry');
      return {
        id: String(row.id),
        name: String(row.name ?? 'Someone'),
        kind: guests ? `${label} for ${guests}` : label,
      };
    });
}

/* --------------------------------------------------------------- tickets -- */

export interface RecentOrder {
  key: string;
  customer: string;
  tickets: number;
  totalCents: number;
  eventTitle: string;
  at: string;
}

/** The last few orders across the nights on sale now. */
export async function loadRecentOrders(events: ResolvedEvent[], limit = 5): Promise<RecentOrder[]> {
  const onSale = events.filter((event) => event.ticketing.enabled && event.overrideId).slice(0, 6);
  const lists = await Promise.all(
    onSale.map((event) =>
      safely(listOrders(event.overrideId!), [] as AdminOrder[]).then((orders) => orders.map((order) => ({ event, order }))),
    ),
  );
  return lists
    .flat()
    .filter(({ order }) => order.status === 'paid' || order.status === 'partially_refunded')
    .sort((a, b) => (b.order.paidAt ?? b.order.createdAt).localeCompare(a.order.paidAt ?? a.order.createdAt))
    .slice(0, limit)
    .map(({ event, order }) => ({
      key: `${event.id}:${order.id}`,
      customer: order.customerName ?? order.customerEmail ?? 'A guest',
      tickets: order.items.reduce((sum, item) => sum + item.quantity, 0),
      totalCents: order.totalCents - order.refundedCents,
      eventTitle: event.title,
      at: order.paidAt ?? order.createdAt,
    }));
}

/** "3 hours ago", "just now". */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
