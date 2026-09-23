import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { LinkButton } from '@/components/admin/ui';
import { HeadlineStrip, type HeadlineCell } from '@/components/admin/tonight/HeadlineStrip';
import {
  loadFloor,
  loadRecentOrders,
  loadTeamWaiting,
  previewEnquiries,
  roomTonight,
  safely,
  serviceDate,
  type FloorTonight,
  type TeamWaiting,
} from '@/components/admin/tonight/load';
import { NeedsYou, type NeedsItem } from '@/components/admin/tonight/NeedsYou';
import { NightHero, whenLabel } from '@/components/admin/tonight/NightHero';
import { OnTheFloor } from '@/components/admin/tonight/OnTheFloor';
import { Quiet } from '@/components/admin/tonight/parts';
import { QuickActions } from '@/components/admin/tonight/QuickActions';
import { ComingUp, formatMoney, TicketActivity } from '@/components/admin/tonight/TicketActivity';
import { getSiteSettings } from '@/content/resolve';
import type { ResolvedEvent } from '@/content/types';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getUpcomingEvents, venueIsoDate } from '@/lib/events';
import { formatTimeRangeCompact } from '@/lib/format';
import { getOpenState } from '@/lib/hours';
import { addDays, formatDate, formatDayShort, formatClockShort } from '@/lib/staff/time';
import { getStaff } from '@/server/auth';
import { getAttention, housekeepingSentence, type Attention } from '@/server/content/attention';
import { getEditableEvents } from '@/server/content/events';
import { getEventAvailability } from '@/server/ticketing/availability';
import { isTicketingConfigured } from '@/server/ticketing/db';
import { getSalesSummaries, type SalesSummary } from '@/server/ticketing/sales';

export const dynamic = 'force-dynamic';

/**
 * Home is "Tonight": what is happening today, answered before anything else.
 *
 * Read top to bottom it is the owner's walk-through at five o'clock: is the
 * room open and until when, what is on and how full it is, who is working,
 * what is waiting on me, how the week is selling. It is not an analytics
 * screen — every figure is one somebody can act on tonight, and every empty
 * section says so in a sentence instead of a zero.
 *
 * Money problems (a night on sale with nothing priced, a door nobody is
 * scanning) lead "Needs you", marked "Now". Housekeeping is one quiet,
 * uncounted sentence at the end of it.
 */
export default async function AdminHome() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  // An employee account's work is in the staff app, not here.
  if (staff.role === 'staff' || staff.role === 'contractor') redirect('/staff');

  const now = new Date();
  const db = getReadDb();
  // The roster and the team's requests are people's data: owner and managers only.
  const seesTeam = staff.role === 'owner' || staff.role === 'admin';
  const settings = await getSiteSettings();
  const timeZone = settings.timeZone || 'America/Chicago';

  const noTeam: TeamWaiting = { coverage: [], timeOff: [], unacknowledged: [] };
  const [events, attention, inquiries, applicants, talent, floor, team] = await Promise.all([
    db ? safely(getEditableEvents(db), { series: [], occurrences: [] }) : { series: [], occurrences: [] },
    db ? safely(getAttention(db, now), [] as Attention[]) : [],
    db ? safely(db.list<Row>('inquiries', { where: { status: 'new' } }), [] as Row[]) : [],
    db ? safely(db.list<Row>('job_applications', { where: { status: 'new' }, limit: 200 }), [] as Row[]) : [],
    db ? safely(db.list<Row>('talent_submissions', { where: { status: 'new' }, limit: 200 }), [] as Row[]) : [],
    db && seesTeam ? safely(loadFloor(db, now, timeZone), null) : null,
    db && seesTeam ? safely(loadTeamWaiting(db, now), noTeam) : noTeam,
  ]);

  /* ------------------------------------------------------------ the night -- */

  const today = floor?.date ?? serviceDate(now, timeZone);
  const tomorrow = addDays(today, 1);
  const upcoming = getUpcomingEvents(events, now);
  const happening = (event: ResolvedEvent) => event.status !== 'cancelled' && event.status !== 'postponed';
  // Tonight is every night on the calendar today, recurring or not; a
  // ticketed one leads because it has a door to run.
  const tonight = upcoming
    .filter((event) => venueIsoDate(event.startsAt) === today && happening(event))
    .sort((a, b) => Number(b.ticketing.enabled) - Number(a.ticketing.enabled));
  // Beyond tonight, the one-off nights: the weekly regulars would otherwise
  // fill every slot and bury the night that is actually selling.
  const oneOffs = upcoming.filter((event) => event.seriesSlug === null && !tonight.includes(event));
  const hero = tonight[0] ?? oneOffs[0] ?? upcoming.find(happening) ?? null;
  const later = oneOffs.filter((event) => event !== hero).slice(0, 4);
  const week = upcoming.filter((event) => event.ticketing.enabled && Date.parse(event.startsAt) < now.getTime() + 7 * 86_400_000);

  const ids = [...new Set([...tonight, ...oneOffs.slice(0, 8), ...week].map((event) => event.overrideId).filter((id): id is string => Boolean(id)))];
  const [summaries, heroAvailability, orders] = await Promise.all([
    safely(getSalesSummaries(ids), new Map<string, SalesSummary>()),
    hero?.ticketing.enabled && hero.overrideId ? safely(getEventAvailability(hero.overrideId), null) : Promise.resolve(null),
    safely(loadRecentOrders(week, 4), []),
  ]);
  const summaryOf = (event: ResolvedEvent | null | undefined) => (event?.overrideId ? summaries.get(event.overrideId) ?? null : null);
  const weekSold = week.reduce((sum, event) => sum + (summaryOf(event)?.ticketsSold ?? 0), 0);
  const weekCents = week.reduce((sum, event) => sum + (summaryOf(event)?.netCents ?? 0), 0);

  /* ------------------------------------------------------------- the room -- */

  const openState = getOpenState(settings.hours.value, settings.temporaryClosures, now, timeZone);
  const room = roomTonight(settings.hours.value, settings.temporaryClosures, today);
  const roomOpenTonight = room.hours !== null;

  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = staff.source === 'open' ? '' : `, ${(staff.name || staff.email).split(/[\s@]+/)[0]}`;
  const dateLine = `${formatDate(today)}. ${
    tonight.length === 0
      ? roomOpenTonight
        ? 'Dinner service, nothing special on.'
        : 'No service tonight.'
      : tonight.length === 1
        ? `${tonight[0]!.title} tonight.`
        : `${tonight.length} things on tonight.`
  }`;

  /* ------------------------------------------------------------ the strip -- */

  const cells: HeadlineCell[] = [
    roomCell(openState, room),
    tonightCell(tonight, summaryOf, roomOpenTonight),
    seesTeam && floor ? floorCell(floor) : nextCell(oneOffs[0] ?? null, summaryOf),
    {
      label: 'Next 7 days',
      value: week.length === 0 ? 'Quiet' : formatMoney(weekCents),
      numeric: week.length > 0,
      detail: week.length === 0 ? 'No ticketed nights this week' : `${weekSold} tickets · ${week.length} ${week.length === 1 ? 'night' : 'nights'}`,
      href: '/admin/events',
    },
  ];

  /* ----------------------------------------------------------- needs you -- */

  const needs: NeedsItem[] = [
    ...moneyProblems(hero, summaries, now, heroAvailability?.tiers.length ?? null, upcoming),
    ...needsFromTeam(team, today, tomorrow, 'soon'),
  ];
  if (inquiries.length > 0) {
    const preview = previewEnquiries(inquiries);
    needs.push({
      id: 'inquiries',
      lead: inquiries.length,
      title: inquiries.length === 1 ? 'New enquiry' : 'New enquiries',
      detail: preview.slice(0, 2).map((entry) => `${entry.name} — ${entry.kind}`).join(' · '),
      href: '/admin/inquiries',
    });
  }
  needs.push(...needsFromTeam(team, today, tomorrow, 'later'));
  if (applicants.length > 0) {
    needs.push({
      id: 'applicants',
      lead: applicants.length,
      title: applicants.length === 1 ? 'New job application' : 'New job applications',
      detail: applicants.slice(0, 2).map((row) => [row.name, row.position].filter(Boolean).join(' for ')).join(' · '),
      href: '/admin/hiring',
    });
  }
  if (talent.length > 0) {
    needs.push({
      id: 'talent',
      lead: talent.length,
      title: talent.length === 1 ? 'New talent submission' : 'New talent submissions',
      detail: talent.slice(0, 2).map((row) => String(row.name ?? 'Someone')).join(' · '),
      href: '/admin/talent',
    });
  }
  for (const announcement of team.unacknowledged.slice(0, 2)) {
    const waiting = (announcement.audience ?? 0) - (announcement.acknowledged ?? 0);
    needs.push({
      id: `announcement-${announcement.id}`,
      lead: waiting,
      title: `Still to confirm “${announcement.title}”`,
      detail: `${announcement.acknowledged ?? 0} of ${announcement.audience ?? 0} of the team have read and acknowledged it`,
      href: '/staff/announcements/manage',
    });
  }
  const blocking = attention.filter((entry) => entry.severity === 'blocking' && entry.kind !== 'tickets');
  if (blocking.length > 0) {
    needs.push({
      id: 'website',
      lead: blocking.length,
      title: blocking.length === 1 ? 'Thing on the website needs fixing' : 'Things on the website need fixing',
      detail: blocking[0]!.message,
      href: blocking.length === 1 ? blocking[0]!.href : '/admin/tidy',
    });
  }
  const housekeeping = housekeepingSentence(attention.filter((entry) => entry.severity !== 'blocking' && entry.kind !== 'tickets'));

  /* --------------------------------------------------------------- render -- */

  return (
    <AdminShell staff={staff} local={isLocalDb()} title={`${greeting}${name}.`} description={dateLine}>
      <HeadlineStrip cells={cells} />

      {/* Two columns from a laptop up. On a phone the columns dissolve
          (`contents`) so the sections can be re-ordered: the night, then
          what is waiting on you, then the floor, then the money. */}
      <div className="mt-8 grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="contents lg:grid lg:min-w-0 lg:content-start lg:gap-10">
          <div className="order-1 min-w-0 lg:order-none">
            {hero ? (
              <NightHero
                event={hero}
                eyebrow={tonight.includes(hero) ? 'Tonight' : `Up next · ${whenLabel(hero, today, tomorrow, venueIsoDate)}`}
                summary={summaryOf(hero)}
                tiersKnown={heroAvailability?.tiers.length ?? null}
                ticketingOn={isTicketingConfigured()}
              >
                {tonight.length > 1 ? (
                  <p className="text-[0.9375rem] text-brown-soft">
                    Also tonight:{' '}
                    {tonight.slice(1).map((event, index) => (
                      <span key={event.id}>
                        {index > 0 ? ', ' : ''}
                        <span className="font-semibold text-brown">{event.title}</span>{' '}
                        <span className="tabular">{formatTimeRangeCompact(event.startsAt, event.endsAt)}</span>
                      </span>
                    ))}
                  </p>
                ) : null}
              </NightHero>
            ) : (
              <Quiet title="Nothing on the calendar yet.">
                <p>Want to put something up? A flyer and a date is enough to start.</p>
                <div className="mt-4">
                  <LinkButton href="/admin/events/new" variant="primary">
                    Add an event
                  </LinkButton>
                </div>
              </Quiet>
            )}
          </div>

          {seesTeam && floor ? (
            <div className="order-3 min-w-0 lg:order-none">
              <OnTheFloor floor={floor} roomOpen={roomOpenTonight} now={now} />
            </div>
          ) : null}

          <div className="order-4 min-w-0 lg:order-none">
            <TicketActivity weekCents={weekCents} weekSold={weekSold} weekEvents={week.length} orders={orders} now={now} />
          </div>
        </div>

        <div className="contents lg:grid lg:min-w-0 lg:content-start lg:gap-10">
          <div className="order-2 min-w-0 lg:order-none">
            <NeedsYou items={needs} housekeeping={housekeeping} />
          </div>
          <div className="order-5 min-w-0 lg:order-none">
            <ComingUp events={later} summaries={summaries} />
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-brown/10 pt-8">
        <QuickActions />
      </div>
    </AdminShell>
  );
}

/* -------------------------------------------------------------------------- */

function roomCell(openState: ReturnType<typeof getOpenState>, room: ReturnType<typeof roomTonight>): HeadlineCell {
  const base = { label: 'The room', href: '/admin/settings' };
  if (openState.open) {
    return { ...base, value: openState.label, signal: 'on', detail: room.hours ? `Tonight ${room.hours}` : 'Open now' };
  }
  if (room.hours && openState.label.startsWith('Opens at')) {
    return { ...base, value: openState.label, signal: 'off', detail: `Tonight ${room.hours}` };
  }
  if (room.hours) {
    return { ...base, value: 'Closed', signal: 'off', detail: `Tonight was ${room.hours}. Rest up.` };
  }
  return { ...base, value: 'Closed tonight', signal: 'off', detail: room.closedReason ?? openState.closureReason ?? 'No service today' };
}

function tonightCell(
  tonight: ResolvedEvent[],
  summaryOf: (event: ResolvedEvent) => SalesSummary | null,
  roomOpen: boolean,
): HeadlineCell {
  const first = tonight[0];
  if (!first) {
    return {
      label: 'Tonight',
      value: roomOpen ? 'Dinner service' : 'Nothing on',
      detail: roomOpen ? 'No event on the calendar' : 'A night off',
      href: '/admin/events',
    };
  }
  const summary = summaryOf(first);
  const attendance = first.ticketing.enabled
    ? summary
      ? summary.capacity
        ? `${summary.ticketsSold} of ${summary.capacity} expected`
        : `${summary.ticketsSold} expected`
      : 'no sales yet'
    : first.ticketUrl
      ? 'sold on Tickeri'
      : 'walk-in';
  return {
    label: tonight.length > 1 ? `Tonight · ${tonight.length} events` : 'Tonight',
    value: first.title,
    detail: `${formatTimeRangeCompact(first.startsAt, first.endsAt)} · ${attendance}`,
    href: first.overrideId ? `/admin/events/one/${encodeURIComponent(first.overrideId)}` : `/admin/events/${first.seriesSlug ?? ''}`,
  };
}

function floorCell(floor: FloorTonight): HeadlineCell {
  const count = floor.scheduled.length;
  const openShifts = floor.open.length;
  if (count === 0 && openShifts === 0) {
    return {
      label: 'On the floor',
      value: 'Nobody on',
      detail: floor.nextNight ? `Next: ${formatDate(floor.nextNight.date, 'short')}, ${floor.nextNight.scheduled.length} on` : 'Nothing scheduled this week',
      href: '/staff/schedule',
    };
  }
  return {
    label: 'On the floor',
    value: count === 1 ? '1 person' : `${count} people`,
    detail: openShifts > 0 ? `${openShifts} ${openShifts === 1 ? 'shift' : 'shifts'} still open` : 'Every shift filled',
    href: '/staff/schedule',
  };
}

function nextCell(next: ResolvedEvent | null, summaryOf: (event: ResolvedEvent) => SalesSummary | null): HeadlineCell {
  if (!next) return { label: 'Up next', value: 'Nothing yet', detail: 'The calendar is clear', href: '/admin/events/new' };
  const summary = summaryOf(next);
  return {
    label: 'Up next',
    value: next.title,
    detail: `${formatDayShort(next.startsAt, 'America/Chicago')}${summary?.capacity ? ` · ${summary.ticketsSold} of ${summary.capacity}` : ''}`,
    href: next.overrideId ? `/admin/events/one/${encodeURIComponent(next.overrideId)}` : '/admin/events',
  };
}

/**
 * Coverage and time off, split by urgency: a shift in the next two nights
 * with nobody to work it outranks an enquiry; one next week does not.
 */
function needsFromTeam(team: TeamWaiting, today: string, tomorrow: string, when: 'soon' | 'later'): NeedsItem[] {
  const items: NeedsItem[] = [];
  const soon = (iso: string) => {
    const date = venueIsoDate(iso);
    return date === today || date === tomorrow;
  };
  const coverage = team.coverage.filter((request) => (when === 'soon' ? soon(request.shift.startsAt) : !soon(request.shift.startsAt)));
  if (coverage.length > 0) {
    const first = coverage[0]!;
    const zone = first.shift.locationTimezone;
    const whenText = `${formatDayShort(first.shift.startsAt, zone).split(',')[0]} ${formatClockShort(first.shift.startsAt, zone).toLowerCase().replace(' ', '')}`;
    items.push({
      id: `coverage-${when}`,
      lead: coverage.length,
      title: coverage.length === 1 ? 'Shift needs cover' : 'Shifts need cover',
      detail:
        first.status === 'claimed' && first.claimedByName
          ? `${first.claimedByName} will take ${first.requestedByName}’s ${first.shift.positionName.toLowerCase()} shift, ${whenText} — approve?`
          : `${first.requestedByName} asked for cover · ${first.shift.positionName}, ${whenText}`,
      href: '/staff/schedule/coverage',
    });
  }
  if (when === 'later' && team.timeOff.length > 0) {
    items.push({
      id: 'time-off',
      lead: team.timeOff.length,
      title: team.timeOff.length === 1 ? 'Time-off request to decide' : 'Time-off requests to decide',
      detail: team.timeOff.slice(0, 2).map((request) => `${request.employeeName}, ${formatDate(request.startsOn, 'short')}`).join(' · '),
      href: '/staff/operations/time-off',
    });
  }
  return items;
}

/**
 * Real problems: only things that cost money right now.
 * Anything else is housekeeping, and if it is not clear which, it is housekeeping.
 */
function moneyProblems(
  hero: ResolvedEvent | null,
  summaries: Map<string, SalesSummary>,
  now: Date,
  heroTiers: number | null,
  upcoming: ResolvedEvent[],
): NeedsItem[] {
  const problems: NeedsItem[] = [];
  if (hero?.published && hero.ticketing.enabled && heroTiers === 0) {
    problems.push({
      id: 'no-tiers',
      lead: 'Now',
      title: `${hero.title} is on sale with nothing priced`,
      detail: 'Guests can see it but cannot buy. Add a ticket price.',
      href: `/admin/events/one/${encodeURIComponent(hero.overrideId ?? '')}`,
    });
  }
  for (const event of upcoming) {
    if (!event.ticketing.enabled || !event.overrideId) continue;
    const summary = summaries.get(event.overrideId);
    const started = Date.parse(event.startsAt);
    if (summary && summary.ticketsSold > 0 && summary.checkedIn === 0 && now.getTime() > started + 30 * 60_000 && now.getTime() < Date.parse(event.endsAt)) {
      problems.push({
        id: `no-checkins-${event.id}`,
        lead: 'Now',
        title: `Nobody checked in at ${event.title} yet`,
        detail: 'It started half an hour ago. Open the scanner at the door.',
        href: `/admin/scan?event=${encodeURIComponent(event.overrideId)}`,
      });
    }
  }
  return problems;
}
