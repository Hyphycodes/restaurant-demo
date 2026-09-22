import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, LinkButton, Notice, StateChip } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getSeriesOccurrences, venueIsoDate } from '@/lib/events';
import { formatEventDateLong, formatTimeRange } from '@/lib/format';
import { getStaff, staffCan } from '@/server/auth';
import { ArtworkSourceNote, ArtworkThumb, artworkSourceOf } from '@/components/admin/Artwork';
import { getMediaMap } from '@/content/media';
import { getEditableEvents } from '@/server/content/events';
import { canOpen } from '@/server/permissions';
import { BulkTicketLinks, OccurrenceEditor, ResetOccurrence } from './OccurrenceEditor';
import { SeriesEditor } from './SeriesEditor';

export const dynamic = 'force-dynamic';

/**
 * One repeating night.
 *
 * The series defaults sit at the top; the generated dates sit underneath, each
 * one openable. Nothing here materialises a schedule into the database — the
 * dates are computed, and a record is only created for a night that genuinely
 * differs, which is why running this page twice cannot produce duplicates.
 */
export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
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

  const { slug } = await params;
  const { date: openDate } = await searchParams;

  const db = getReadDb();
  if (!db) notFound();

  const events = await getEditableEvents(db);
  const series = events.series.find((entry) => entry.slug === slug);
  if (!series) notFound();

  const now = new Date();
  const occurrences = getSeriesOccurrences(events, slug, now, 10);
  const canPublish = staffCan(staff, 'content.publish');

  const media = await db.list<Row>('media_assets', { orderBy: 'asset_id' });
  const flyerOptions = media
    .filter((row) => row.path && !row.archived_at && row.kind === 'image')
    .map((row) => ({ id: String(row.asset_id), label: String(row.title ?? row.asset_id) }));

  const assets = await getMediaMap();
  const seriesFlyer = series.flyerAssetId ? (assets[series.flyerAssetId] ?? null) : null;
  // Nights that would follow a change to the series artwork — the ones with no
  // flyer of their own.
  const inheritingCount = occurrences.filter(
    (event) => !event.overriddenFields.includes('flyerAssetId'),
  ).length;

  const suggestion = occurrences
    .slice(0, 3)
    .map((event) => `${venueIsoDate(event.startsAt)} https://`)
    .join('\n');

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={series.title}
      description="Change the details every night inherits, or change one night on its own."
      backTo={{ href: '/admin/events', label: 'All events' }}
      actions={
        <LinkButton href={`/events/${series.slug}`} external>
          View on the website
        </LinkButton>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <SeriesEditor
          series={series}
          canPublish={canPublish}
          flyerOptions={flyerOptions}
          inheritingCount={inheritingCount}
          flyerPreview={
            <div className="grid justify-items-start gap-1.5">
              <ArtworkThumb asset={seriesFlyer} size="lg" />
              <ArtworkSourceNote source={series.flyerAssetId ? 'series' : 'none'} />
              {seriesFlyer?.alt ? (
                <p className="max-w-40 text-[0.75rem] leading-snug text-brown-soft">
                  {seriesFlyer.alt}
                </p>
              ) : null}
            </div>
          }
        />

        <div className="grid gap-5">
          <Card title="The next dates">
            {occurrences.length === 0 ? (
              <EmptyState>
                {series.paused
                  ? 'This night is paused, so no dates are being generated.'
                  : 'No dates coming up.'}
              </EmptyState>
            ) : (
              <>
                <p className="mb-4 text-[0.875rem] leading-relaxed text-brown-soft">
                  These are worked out from the schedule, so they are always right and you never add
                  them one by one. Open a date to change just that night.
                </p>
                <ul className="grid gap-2">
                  {occurrences.map((event) => {
                    const date = venueIsoDate(event.startsAt);
                    const changed = event.overriddenFields.length > 0;
                    return (
                      <li key={event.id}>
                        <details
                          open={openDate === date}
                          className="rounded-(--radius-sm) border border-brown/15 bg-ivory"
                        >
                          <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                            <span className="tabular text-[0.9375rem] font-semibold text-brown">
                              {formatEventDateLong(event.startsAt)}
                            </span>
                            <span className="tabular text-[0.8125rem] text-brown-soft">
                              {formatTimeRange(event.startsAt, event.endsAt)}
                            </span>
                            {changed ? <StateChip state="changed" /> : null}
                            {event.status !== 'scheduled' ? (
                              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-danger">
                                {event.status}
                              </span>
                            ) : null}
                            {!event.ticketUrl ? (
                              <span className="ml-auto text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-danger">
                                No tickets
                              </span>
                            ) : null}
                          </summary>

                          <div className="border-t border-brown/12 p-3">
                            <OccurrenceEditor
                              event={event}
                              date={date}
                              seriesSlug={series.slug}
                              flyerOptions={flyerOptions}
                              artwork={
                                <div className="flex items-center gap-3">
                                  <ArtworkThumb
                                    asset={
                                      event.flyerAssetId
                                        ? (assets[event.flyerAssetId] ?? null)
                                        : null
                                    }
                                  />
                                  <ArtworkSourceNote source={artworkSourceOf(event)} />
                                </div>
                              }
                            />
                            {event.overrideId ? (
                              <div className="mt-3 border-t border-dashed border-brown/20 pt-3">
                                <p className="mb-2 text-[0.8125rem] text-brown-soft">
                                  Changed for this night: {event.overriddenFields.join(', ') || 'nothing'}
                                </p>
                                <ResetOccurrence id={event.overrideId} />
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>

          <Card title="Ticket links">
            <Notice tone="info">
              Tickets are sold on your ticketing site, not here. This just stores the link each night
              points at.
            </Notice>
            <div className="mt-4">
              <BulkTicketLinks seriesSlug={series.slug} suggestion={suggestion} />
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
