import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { ArtworkSourceNote, ArtworkThumb, artworkSourceOf } from '@/components/admin/Artwork';
import { Card, EmptyState, HelpNote, LinkButton, Notice, StateChip, Tabs } from '@/components/admin/ui';
import { getMediaMap } from '@/content/media';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getUpcomingEvents, standaloneEvents, ineligibleReason, venueIsoDate } from '@/lib/events';
import { formatEventDateLong, formatPrice, formatTimeRange } from '@/lib/format';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableEvents } from '@/server/content/events';
import { getSalesSummaries, type SalesSummary } from '@/server/ticketing/sales';
import type { PublicAsset } from '@/content/media';
import type { ResolvedEvent } from '@/content/types';
import { canOpen } from '@/server/permissions';
import { NewSeries } from './EventControls';
import { NewOneTimeEvent } from './NewOneTimeEvent';
import { TickeriSync } from './TickeriSync';
import { OccurrencePublish } from './OccurrencePublish';

export const dynamic = 'force-dynamic';

type Tab = 'upcoming' | 'series' | 'drafts' | 'past' | 'cancelled';

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'All nights' },
  { id: 'series', label: 'Repeating nights' },
  { id: 'cancelled', label: 'Cancelled' },
];

/** How many rows sit behind each tab, so a waiting draft is visible unopened. */
const TAB_COUNT: Partial<
  Record<
    Tab,
    (counts: { ready: unknown[]; drafts: unknown[]; cancelled: unknown[]; series: number }) => number
  >
> = {
  upcoming: (counts) => counts.ready.length,
  series: (counts) => counts.series,
  drafts: (counts) => counts.drafts.length,
  cancelled: (counts) => counts.cancelled.length,
};

/**
 * Events.
 *
 * The list leads with date and readiness, because the question this screen exists
 * to answer is "is Friday ready to sell". A row that is missing its ticket link
 * or its artwork says so in the row, rather than looking identical to one that is
 * fine.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; window?: string; new?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return (
      <AdminShell staff={staff} local={local} title="Events">
        <NoAccess what="events" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  const params = await searchParams;
  const tab = (TABS.find((t) => t.id === params.tab)?.id ?? 'upcoming') as Tab;
  const now = new Date();
  const canPublish = staffCan(staff, 'content.publish');

  const [events, overrides, mediaRows, media] = db
    ? await Promise.all([
        getEditableEvents(db),
        db.list<Row>('event_occurrences', { orderBy: 'starts_at' }),
        db.list<Row>('media_assets'),
        getMediaMap(),
      ])
    : [{ series: [], occurrences: [] }, [], [], await getMediaMap()];
  const flyerOptions = mediaRows
        .filter((row) => row.kind === 'image' && row.path && !row.archived_at)
        .map((row) => ({ id: String(row.asset_id), label: String(row.title ?? row.asset_id) }))
        .sort((a, b) => a.label.localeCompare(b.label));

  const upcoming = getUpcomingEvents(events, now, 40);
  // Resolved once for every row on the page rather than per thumbnail.
  // A month by default. Forty rows of "Friday, then Saturday, then Friday" is a
  // list nobody reads; the next four weeks is the window a restaurant works in.
  const windowDays = params.window === '7' ? 7 : params.window === 'all' ? null : 30;
  const horizon = windowDays ? now.getTime() + windowDays * 86_400_000 : Infinity;

  const visible = upcoming.filter((event) => new Date(event.startsAt).getTime() <= horizon);
  const drafts = standaloneEvents(events.occurrences).filter((event) => !event.published && !event.archivedAt);
  const cancelled = visible.filter((event) => event.status === 'cancelled');
  const ready = visible.filter((event) => ineligibleReason(event, now) === null);

  // Special events are the one-off rows: everything on the calendar that is not
  // a Friday or a Saturday. They are what staff actually add and dress up.
  const specials = getUpcomingEvents(events, now, 60).filter((event) => !event.seriesSlug);
  const lastSynced = overrides
    .map((row) => (row.synced_at ? String(row.synced_at) : null))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const lastSyncedLabel = lastSynced ? formatEventDateLong(lastSynced) : null;

  const past = overrides
    .filter((row) => !row.series_slug && String(row.starts_at).slice(0, 10) < venueIsoDate(now.toISOString()))
    .slice(-15)
    .reverse();
  const summaries = await getSalesSummaries([...specials, ...drafts].map((event) => event.overrideId!).filter(Boolean));

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Events"
      description="Add a special event, or update one of your regular Friday and Saturday nights."
      actions={
        <>
          <LinkButton href="/admin/events/new" variant="primary">
            Add an event
          </LinkButton>
          <LinkButton href="/events" external>
            View website
          </LinkButton>
        </>
      }
    >
      {!db ? (
        <EmptyState>
          The content system is not connected, so events are read from the built-in content.
        </EmptyState>
      ) : (
        <>
          {params.new === '1' ? (
            <div className="mb-6">
              <NewOneTimeEvent flyerOptions={flyerOptions} canPublish={canPublish} />
            </div>
          ) : null}

          {canPublish ? (
            <div className="mb-6">
              <TickeriSync lastSyncedLabel={lastSyncedLabel} />
            </div>
          ) : null}

          <EventGroups
            onSale={specials.filter((event) => event.published)}
            drafts={drafts}
            pastRows={past}
            summaries={summaries}
            media={media}
          />

          <div className="mb-5">
            <Tabs
              label="Which events"
              items={TABS.map((entry) => ({
                href: `/admin/events?tab=${entry.id}`,
                label: entry.label,
                active: entry.id === tab,
                count: TAB_COUNT[entry.id]?.({ ready, drafts, cancelled, series: events.series.length }),
              }))}
            />
          </div>

          {tab === 'upcoming' ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2 text-[0.8125rem]">
                <span className="inline-flex min-h-11 items-center text-brown-soft">Show:</span>
                {[
                  { label: 'Next 7 days', value: '7' },
                  { label: 'Next 30 days', value: '30' },
                  { label: 'Everything', value: 'all' },
                ].map((filter) => (
                  <Link
                    key={filter.label}
                    href={`/admin/events?tab=upcoming&window=${filter.value}`}
                    aria-current={(params.window ?? '30') === filter.value ? 'true' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-(--radius-sm) border px-3 font-medium ${
                      (params.window ?? '30') === filter.value
                        ? 'border-clay text-clay'
                        : 'border-brown/25 text-brown-soft'
                    }`}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>

              <Card title={`${ready.length} night${ready.length === 1 ? '' : 's'} coming up`}>
                {ready.length === 0 ? (
                  <EmptyState>Nothing scheduled in this period.</EmptyState>
                ) : (
                  <ReadinessTable events={ready} canPublish={canPublish} now={now} media={media} />
                )}
              </Card>
            </>
          ) : null}

          {tab === 'series' ? (
            <div className="grid gap-4">
              {canPublish ? <NewSeries /> : null}
              {events.series.map((series) => {
                const next = ready.filter((event) => event.seriesSlug === series.slug);
                return (
                  <Card
                    key={series.slug}
                    title={series.title}
                    action={
                      <Link
                        href={`/admin/events/${series.slug}`}
                        className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-coral px-4 text-[0.9375rem] font-semibold text-on-orange"
                      >
                        Edit this night
                      </Link>
                    }
                  >
                    <dl className="grid gap-x-8 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
                      <Row label="Repeats">
                        {series.cadence.kind === 'weekly'
                          ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][series.cadence.weekday]}`
                          : 'One-off'}
                      </Row>
                      <Row label="Time">
                        {String(Math.floor(series.startMinutes / 60)).padStart(2, '0')}:
                        {String(series.startMinutes % 60).padStart(2, '0')} to{' '}
                        {String(Math.floor((series.endMinutes % 1440) / 60)).padStart(2, '0')}:
                        {String(series.endMinutes % 60).padStart(2, '0')}
                      </Row>
                      <Row label="Music">{series.musicFormats.join(' · ') || '—'}</Row>
                      <Row label="Entry">
                        {series.priceCents != null ? formatPrice(series.priceCents) : 'At the door'}
                      </Row>
                      <Row label="Next dates">
                        {next
                          .slice(0, 3)
                          .map((event) => venueIsoDate(event.startsAt))
                          .join(', ') || 'None'}
                      </Row>
                      <Row label="Artwork">{series.flyerAssetId ?? 'None yet'}</Row>
                    </dl>
                    {series.paused ? (
                      <div className="mt-4">
                        <Notice tone="warning">
                          Paused — no new dates are being put on the website.
                        </Notice>
                      </div>
                    ) : null}
                  </Card>
                );
              })}

            </div>
          ) : null}

          {tab === 'drafts' ? (
            <Card title="Drafts">
              {drafts.length === 0 ? (
                <EmptyState>No drafts. Everything you have made is either live or archived.</EmptyState>
              ) : (
                <ReadinessTable events={drafts} canPublish={canPublish} now={now} media={media} />
              )}
            </Card>
          ) : null}

          {tab === 'cancelled' ? (
            <Card title="Cancelled nights">
              {cancelled.length === 0 ? (
                <EmptyState>Nothing is cancelled.</EmptyState>
              ) : (
                <>
                  <HelpNote>
                    A cancelled night stays on the website for two weeks so anyone holding a ticket
                    finds out. It is never offered as “what’s on”.
                  </HelpNote>
                  <div className="mt-4">
                    <ReadinessTable events={cancelled} canPublish={canPublish} now={now} media={media} />
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {tab === 'past' ? (
            <Card title="Past nights you changed">
              {past.length === 0 ? (
                <EmptyState>
                  Nothing here. Ordinary repeating nights are not stored one by one — only nights you
                  changed are kept.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-brown/12">
                  {past.map((row) => (
                    <li key={String(row.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                      <span className="tabular w-28 shrink-0 text-[0.875rem] font-semibold text-brown">
                        {String(row.starts_at).slice(0, 10)}
                      </span>
                      <span className="min-w-0 flex-1 text-[0.9375rem] text-brown">
                        {String(row.title ?? row.series_slug ?? 'Night')}
                      </span>
                      <span className="text-[0.8125rem] text-brown-soft">{String(row.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}

/**
 * The list, newest first, in the three states an event can be in.
 * Each row: flyer, name, date, sold of capacity, state. One glance.
 */
function EventGroups({
  onSale,
  drafts,
  pastRows,
  summaries,
  media,
}: {
  onSale: ResolvedEvent[];
  drafts: ResolvedEvent[];
  pastRows: Row[];
  summaries: Map<string, SalesSummary>;
  media: Record<string, PublicAsset>;
}) {
  const soldLine = (event: ResolvedEvent) => {
    const summary = summaries.get(event.overrideId ?? '');
    if (!event.ticketing.enabled) return event.ticketUrl ? 'on Tickeri' : 'no sales';
    if (!summary) return 'not on sale';
    return summary.capacity ? `${summary.ticketsSold} / ${summary.capacity} sold` : `${summary.ticketsSold} sold`;
  };
  const group = (title: string, events: ResolvedEvent[], state: string) =>
    events.length === 0 ? null : (
      <section key={title} className="mb-6">
        <h2 className="text-[1rem] font-semibold text-brown">{title}</h2>
        <ul className="mt-2 divide-y divide-brown/10">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-3 py-3">
              <ArtworkThumb asset={event.flyerAssetId ? (media[event.flyerAssetId] ?? null) : null} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/events/one/${encodeURIComponent(event.overrideId ?? event.id)}`} className="block truncate text-[0.9375rem] font-semibold text-brown underline-offset-4 hover:underline">
                  {event.title || 'Untitled event'}
                </Link>
                <p className="tabular text-[0.8125rem] text-brown-soft">
                  {formatEventDateLong(event.startsAt)} · {soldLine(event)}
                </p>
              </div>
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-brown-soft">{state}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="mb-6">
      {group('On sale', onSale, 'live')}
      {group('Drafts', drafts, 'draft')}
      {pastRows.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-[1rem] font-semibold text-brown">Past</h2>
          <ul className="mt-2 divide-y divide-brown/10">
            {pastRows.map((row) => (
              <li key={String(row.id)} className="flex items-center gap-4 py-2.5 text-[0.9375rem]">
                <span className="tabular w-24 shrink-0 text-brown-soft">{String(row.starts_at).slice(0, 10)}</span>
                <Link href={`/admin/events/one/${encodeURIComponent(String(row.id))}`} className="min-w-0 flex-1 truncate text-brown underline-offset-4 hover:underline">
                  {String(row.title ?? 'Event')}
                </Link>
                <span className="text-[0.75rem] uppercase tracking-[0.06em] text-brown-soft">{String(row.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {onSale.length === 0 && drafts.length === 0 && pastRows.length === 0 ? (
        <EmptyState>No special events yet. New event, top right, is where they start.</EmptyState>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brown/10 py-1.5">
      <dt className="text-brown-soft">{label}</dt>
      <dd className="text-right text-brown">{children}</dd>
    </div>
  );
}

/**
 * The readiness table.
 *
 * Date, time, tickets, artwork, state — the five things that decide whether a
 * night can be sold. Problems are words, not a red dot.
 */
function ReadinessTable({
  events,
  canPublish,
  now,
  media,
}: {
  events: import('@/content/types').ResolvedEvent[];
  canPublish: boolean;
  now: Date;
  media: Record<string, import('@/content/media').PublicAsset>;
}) {
  return (
    <ul className="divide-y divide-brown/12">
      {events.map((event) => {
        const problem = ineligibleReason(event, now);
        const date = venueIsoDate(event.startsAt);
        const source = artworkSourceOf(event);
        return (
          <li className="flex gap-4 py-3" key={event.id}>
            {/* The flyer itself. Two Fridays and a Saturday are only telling
                apart by looking at them. */}
            <ArtworkThumb
              asset={event.flyerAssetId ? (media[event.flyerAssetId] ?? null) : null}
            />
            {}
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="tabular text-[0.9375rem] font-semibold text-brown">
                  {formatEventDateLong(event.startsAt)}
                </span>
                <span className="tabular text-[0.8125rem] text-brown-soft">
                  {formatTimeRange(event.startsAt, event.endsAt)}
                </span>
                <StateChip
                  state={
                    event.archivedAt
                      ? 'archived'
                      : !event.published
                        ? 'draft'
                        : event.overriddenFields.length
                          ? 'changed'
                          : 'published'
                  }
                />
              </div>

              <p className="text-[0.9375rem] text-brown">{event.title}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                {problem ? (
                  <span className="font-semibold text-warning">{problem}</span>
                ) : null}
                {!event.ticketUrl ? (
                  <span className="font-semibold text-danger">No ticket link</span>
                ) : (
                  <span className="text-brown-soft">Tickets set</span>
                )}
                {source === 'none' && event.seriesSlug ? (
                  <Link
                    href={`/admin/events/${event.seriesSlug}`}
                    className="font-semibold text-warning underline underline-offset-4"
                  >
                    Needs artwork
                  </Link>
                ) : (
                  <ArtworkSourceNote source={source} />
                )}
                {event.overriddenFields.filter((f) => f !== 'flyerAssetId').length > 0 ? (
                  <span className="text-clay">
                    Changed for this night:{' '}
                    {event.overriddenFields.filter((f) => f !== 'flyerAssetId').join(', ')}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {event.seriesSlug ? (
                  <Link
                    href={`/admin/events/${event.seriesSlug}?date=${date}`}
                    className="text-[0.8125rem] font-semibold text-clay underline underline-offset-4 hover:text-coral-deep"
                  >
                    Change this night
                  </Link>
                ) : null}
                {canPublish && !event.published && event.overrideId ? (
                  <OccurrencePublish id={event.overrideId} published={false} />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
