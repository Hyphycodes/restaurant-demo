import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { EventPresentationEditor, type ArtSlotState } from '@/components/admin/EventPresentation';
import { EVENT_ART_SLOTS } from '@/content/event-presentation';
import { getMediaMap } from '@/content/media';
import { getSiteSettings } from '@/content/resolve';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { signPreviewToken } from '@/lib/ticketing/tokens';
import { publishProblems } from '@/lib/event-editor';
import type { EditorFields } from '@/server/actions/event-editor';
import { getStaff, staffCan } from '@/server/auth';
import { occurrenceFromRow } from '@/server/content/events';
import { canOpen } from '@/server/permissions';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { venueLocalParts } from '@/themes/schedule';
import { EventEditor, type EditorPromo } from './EventEditor';
import { EventStaffingPanel } from '@/components/staff/EventStaffingPanel';
import { listEmployees } from '@/server/staff/employees';
import { eventStaffing } from '@/server/staff/staffing';
import { getStaffContext, contextCan } from '@/server/staff/session';

export const dynamic = 'force-dynamic';

const ART_COLUMN = {
  flyer: 'flyer_asset_id',
  keyArt: 'key_art_asset_id',
  keyArtMobile: 'key_art_mobile_asset_id',
  foreground: 'foreground_asset_id',
} as const;

/**
 * One event, one page. The editor first; the homepage art direction (key
 * art, treatment) folded away underneath, because it is the thing most
 * people never touch.
 */
export default async function OneOffEventPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return (
      <AdminShell staff={staff} local={local} title="Event">
        <NoAccess what="events" />
      </AdminShell>
    );
  }
  const db = getReadDb();
  if (!db) notFound();

  const { id } = await params;
  const eventId = decodeURIComponent(id);
  const row =
    (await db.get<Row>('event_occurrences', eventId)) ??
    (eventId.startsWith('one-time:') ? await db.get<Row>('event_occurrences', eventId.slice('one-time:'.length)) : null);
  if (!row || row.series_slug) notFound();

  const working = { ...row, ...((row.draft as Row | null) ?? {}) } as Row;
  const record = occurrenceFromRow(row, 'working');
  const [media, settings, tierRows, promoRows, summaries] = await Promise.all([
    getMediaMap(),
    getSiteSettings(),
    db.list<Row>('ticket_tiers', { where: { event_id: String(row.id) }, orderBy: 'sort_order' }),
    db.list<Row>('promo_codes', { where: { event_id: String(row.id) } }).catch(() => [] as Row[]),
    getSalesSummaries([String(row.id)]),
  ]);
  const summary = summaries.get(String(row.id));
  const canPublish = staffCan(staff, 'content.publish');

  const start = venueLocalParts(String(working.starts_at ?? ''), settings.timeZone);
  const end = venueLocalParts(String(working.ends_at ?? ''), settings.timeZone);
  const doors = venueLocalParts((working.doors_open_at as string | null) ?? null, settings.timeZone);
  const fields: EditorFields = {
    title: String(working.title ?? ''),
    summary: String(working.summary ?? ''),
    descriptionHtml: String(working.description_html ?? (working.description ? `<p>${String(working.description).split(/\n\s*\n/).join('</p><p>')}</p>` : '')),
    slug: String(working.slug ?? ''),
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    doorsTime: doors.time,
    ticketingEnabled: Boolean(working.ticketing_enabled),
    externalTicketUrl: String(working.ticket_url ?? ''),
    capacity: typeof working.capacity === 'number' ? working.capacity : null,
    agePolicy: (['all_ages', '18+', '21+'] as const).find((value) => value === working.age_policy) ?? null,
    includedText: String(working.included_text ?? ''),
    bringText: String(working.bring_text ?? ''),
    arrivalText: String(working.arrival_text ?? ''),
    refundPolicy: String(working.refund_policy ?? ''),
    category: (['nightlife', 'vinyl-vermouth', 'brunch', 'comedy', 'special'] as const).find((value) => value === working.category) ?? null,
  };

  const tiers = tierRows.map((tier) => ({
    id: String(tier.id),
    name: String(tier.name ?? ''),
    description: String(tier.description ?? ''),
    priceCents: Number(tier.price_cents ?? 0),
    capacity: typeof tier.capacity === 'number' ? tier.capacity : null,
    maxPerOrder: Number(tier.max_per_order ?? 10),
    seatsPerTicket: Number(tier.seats_per_ticket ?? 1),
    salesStartAt: (tier.sales_start_at as string | null) ?? null,
    salesEndAt: (tier.sales_end_at as string | null) ?? null,
    isActive: tier.is_active !== false,
  }));
  const promos: EditorPromo[] = promoRows.map((promo) => ({
    id: String(promo.id),
    code: String(promo.code),
    kind: promo.kind === 'amount' ? 'amount' : 'percent',
    value: Number(promo.value ?? 0),
    maxRedemptions: typeof promo.max_redemptions === 'number' ? promo.max_redemptions : null,
    redeemedCount: Number(promo.redeemed_count ?? 0),
    endsAt: (promo.ends_at as string | null) ?? null,
    isActive: promo.is_active !== false,
  }));

  const flyerId = working.flyer_asset_id as string | null;
  const art: ArtSlotState[] = EVENT_ART_SLOTS.map((slot) => {
    const assetId = row[ART_COLUMN[slot]] as string | null;
    const asset = assetId ? media[assetId] : null;
    return { slot, path: asset?.path ?? null, filled: Boolean(assetId) };
  });
  const previewUrl = `/events/${encodeURIComponent(String(working.slug ?? ''))}?preview=${encodeURIComponent(signPreviewTokenSafe(String(row.id)))}`;

  // Staffing lives in the staff system; the admin shows the same board so the
  // night can be run from either screen.
  const opsContext = await getStaffContext();
  const canStaffEvents = opsContext ? contextCan(opsContext, 'events.staff') : false;
  const [staffing, employees] = canStaffEvents
    ? await Promise.all([eventStaffing(db, String(row.id)).catch(() => null), listEmployees(db).catch(() => [])])
    : [null, []];

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={fields.title || 'New event'}
      backTo={{ href: '/admin/events', label: 'Events' }}
      actions={
        summary && summary.ordersCount > 0 ? (
          <a href={`/admin/events/${encodeURIComponent(String(row.id))}/sales`} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown">
            Sales · {summary.ticketsSold} sold
          </a>
        ) : undefined
      }
    >
      <EventEditor
        id={String(row.id)}
        published={row.published !== false}
        hasDraft={Boolean(row.draft && Object.keys(row.draft as Row).length > 0)}
        fields={fields}
        flyerPath={flyerId ? (media[flyerId]?.path ?? null) : null}
        tiers={tiers}
        promos={promos}
        paidOrders={summary?.ordersCount ?? 0}
        ticketsSold={summary?.ticketsSold ?? 0}
        previewUrl={previewUrl}
        canPublish={canPublish}
        problems={row.published !== false ? {} : publishProblems(working, tierRows)}
      />

      {staffing ? (
        <section className="mt-10 rounded-(--radius-md) border border-brown/12 px-4 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[1.0625rem] font-semibold text-brown">Staffing</h2>
            <a href={`/staff/events/${encodeURIComponent(String(row.id))}`} className="text-[0.875rem] font-semibold text-brown-soft underline underline-offset-4">
              Open in the staff app
            </a>
          </div>
          <EventStaffingPanel staffing={staffing} employees={employees} timezone={settings.timeZone} canStaff={canStaffEvents} compact />
        </section>
      ) : null}

      <details className="mt-10 rounded-(--radius-md) border border-brown/12 px-4 py-3">
        <summary className="min-h-11 cursor-pointer text-[1rem] font-semibold text-brown">How it appears on the homepage, and extra artwork</summary>
        <div className="mt-4">
          <EventPresentationEditor
            table="event_occurrences"
            id={String(row.id)}
            title={fields.title || 'this event'}
            presentation={record.presentation as never}
            art={art}
            takeover={{
              start: venueLocalParts(record.presentation?.takeoverStartAt ?? null, settings.timeZone),
              end: venueLocalParts(record.presentation?.takeoverEndAt ?? null, settings.timeZone),
            }}
            canPublish={canPublish}
          />
        </div>
      </details>
    </AdminShell>
  );
}

/** A preview link needs the signing secret; without one the plain page is offered. */
function signPreviewTokenSafe(id: string): string {
  try {
    return signPreviewToken(id);
  } catch {
    return '';
  }
}
