'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/content/admin-types';
import type { Row } from '@/lib/db/types';
import { venueLocalIso } from '@/lib/events';
import { getStripe } from '@/lib/stripe';
import { publishProblems, slugify } from '@/lib/event-editor';
import { htmlToText, sanitizeHtml } from '@/lib/sanitize-html';
import { storeMediaFile } from '@/server/media-files';
import { getTicketingClient } from '@/server/ticketing/db';
import { emailService } from '@/server/email/service';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { staffCan } from '../auth';
import { publishDirect, saveDraft } from '../content/editorial';
import { done, run, saved } from './shared';

/**
 * The event editor's server side.
 *
 * One scrolling page in the admin, so one file here. Drafts autosave straight
 * into the row (nothing is public yet); a published event's edits go into its
 * `draft` column until Save, so guests never see half a change. Publishing is
 * explicit and reversible, with the rules that keep money honest: no
 * unpublish or delete while paid orders exist — cancel and refund instead.
 */

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeInput = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const fieldsSchema = z.object({
  title: z.string().trim().max(120),
  summary: z.string().trim().max(200),
  descriptionHtml: z.string().max(20_000),
  slug: z.string().trim().max(80),
  date: dateInput.or(z.literal('')),
  startTime: timeInput.or(z.literal('')),
  endTime: timeInput.or(z.literal('')),
  doorsTime: timeInput.or(z.literal('')),
  ticketingEnabled: z.boolean(),
  externalTicketUrl: z.string().trim().max(400),
  capacity: z.number().int().min(1).nullable(),
  agePolicy: z.enum(['all_ages', '18+', '21+']).nullable(),
  includedText: z.string().trim().max(200),
  bringText: z.string().trim().max(200),
  arrivalText: z.string().trim().max(200),
  refundPolicy: z.string().trim().max(600),
  category: z.enum(['nightlife', 'vinyl-vermouth', 'brunch', 'comedy', 'special']).nullable(),
});

export type EditorFields = z.infer<typeof fieldsSchema>;

function minutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Fields → columns. Only what is set becomes a column; blanks become null. */
function columnsOf(fields: EditorFields): { patch: Row; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const patch: Row = {
    title: fields.title || null,
    summary: fields.summary || null,
    description_html: fields.descriptionHtml ? sanitizeHtml(fields.descriptionHtml) : null,
    description: fields.descriptionHtml ? htmlToText(sanitizeHtml(fields.descriptionHtml)) : null,
    slug: fields.slug ? slugify(fields.slug) : null,
    ticketing_enabled: fields.ticketingEnabled,
    ticket_url: fields.ticketingEnabled ? null : fields.externalTicketUrl || null,
    capacity: fields.capacity,
    age_policy: fields.agePolicy,
    age_min: fields.agePolicy === '21+' ? 21 : fields.agePolicy === '18+' ? 18 : null,
    included_text: fields.includedText || null,
    bring_text: fields.bringText || null,
    arrival_text: fields.arrivalText || null,
    refund_policy: fields.refundPolicy || null,
    category: fields.category,
  };
  if (fields.externalTicketUrl && !/^https:\/\/\S+$/i.test(fields.externalTicketUrl)) {
    problems.externalTicketUrl = 'A ticket link has to start with https://';
  }
  if (fields.date) {
    const [y, m, d] = fields.date.split('-').map(Number);
    const start = fields.startTime ? minutes(fields.startTime) : null;
    let end = fields.endTime ? minutes(fields.endTime) : null;
    if (start !== null) {
      if (end === null) end = start + 180;
      if (end <= start) end += 1440;
      patch.starts_at = venueLocalIso(y!, m!, d!, start);
      patch.ends_at = venueLocalIso(y!, m!, d!, end);
      if (fields.doorsTime) {
        let doors = minutes(fields.doorsTime);
        if (doors > start) doors -= 1440;
        patch.doors_open_at = venueLocalIso(y!, m!, d!, doors);
      } else {
        patch.doors_open_at = null;
      }
    } else {
      problems.startTime = 'Add a start time.';
    }
  }
  return { patch, problems };
}

/* ----------------------------------------------------------- new event -- */

export async function createDraftEvent(): Promise<{ ok: boolean; id?: string; message?: string }> {
  const result = await run('content.edit', async ({ db, staff }) => {
    const id = crypto.randomUUID();
    await db.insert('event_occurrences', {
      id,
      series_slug: null,
      slug: `event-${id.slice(0, 8)}`,
      title: '',
      starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 86_400_000 + 3 * 3_600_000).toISOString(),
      status: 'scheduled',
      published: false,
      draft: null,
      archived_at: null,
      source: 'manual',
      ticketing_enabled: false,
      refund_policy: 'Full refund up to 48 hours before. After that we will move you to another date.',
      updated_by: staff.source === 'supabase' ? staff.id : null,
    });
    return { ok: true, message: id };
  });
  return result.ok ? { ok: true, id: result.message } : { ok: false, message: result.message };
}

/* ------------------------------------------------------------ autosave -- */

export interface AutosaveResult {
  ok: boolean;
  message: string;
  savedAt?: string;
  problems?: Record<string, string>;
}

/**
 * Save as you go. A draft is written straight into the row; a published
 * event's changes wait in `draft` until Save, so the website never shows a
 * sentence half-typed.
 */
export async function autosaveEvent(id: string, raw: unknown): Promise<AutosaveResult> {
  const parsed = fieldsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Some of that could not be saved.' };
  const { patch, problems } = columnsOf(parsed.data);
  const result = await run('content.edit', async ({ db, staff }) => {
    const row = await db.get<Row>('event_occurrences', id);
    if (!row) return { ok: false, message: 'That event no longer exists.' };
    // A slug must be unique across events and series; keep the old one if taken.
    if (patch.slug && patch.slug !== row.slug) {
      const clash = await slugTaken(db.list.bind(db), String(patch.slug), id);
      if (clash) {
        problems.slug = 'Another event already has that address.';
        delete patch.slug;
      }
    }
    if (row.published === false) {
      await db.update('event_occurrences', id, { ...patch, updated_by: staff.source === 'supabase' ? staff.id : null });
    } else {
      await saveDraft(db, 'event_occurrences', id, patch, staff);
    }
    return { ok: true, message: 'Saved' };
  });
  return { ...result, savedAt: new Date().toISOString(), problems };
}

async function slugTaken(
  list: <T extends Row>(table: string, options?: { where?: Record<string, string> }) => Promise<T[]>,
  slug: string,
  exceptId: string,
): Promise<boolean> {
  const [events, series] = await Promise.all([list<Row>('event_occurrences', { where: { slug } }), list<Row>('event_series', { where: { slug } })]);
  return events.some((row) => row.id !== exceptId) || series.length > 0;
}

export async function checkSlug(slug: string, exceptId: string): Promise<{ available: boolean; slug: string }> {
  const clean = slugify(slug);
  const result = await run('content.edit', async ({ db }) => {
    const taken = await slugTaken(db.list.bind(db), clean, exceptId);
    return { ok: !taken, message: clean };
  });
  return { available: result.ok, slug: clean };
}

/* ------------------------------------------------------------- publish -- */

export async function publishEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  return run('content.publish', async ({ db, staff }) => {
    const row = await db.get<Row>('event_occurrences', id);
    if (!row) return { ok: false, message: 'That event no longer exists.' };
    const working = { ...row, ...((row.draft as Row | null) ?? {}) };
    const tiers = await db.list<Row>('ticket_tiers', { where: { event_id: id } });
    const problems = publishProblems(working, tiers);
    if (Object.keys(problems).length > 0) {
      return { ok: false, message: Object.values(problems)[0]!, errors: problems };
    }
    const draft = (row.draft as Row | null) ?? {};
    await publishDirect(db, 'event_occurrences', id, { ...draft, published: true, archived_at: null }, staff);
    revalidatePath(`/events/${working.slug}`);
    return done(
      working.ticketing_enabled ? 'Published. Tickets are on sale now.' : 'Published. It is on the website now.',
      'events',
      [`/events/${working.slug}`],
    );
  });
}

/** Save the waiting changes on a live event. */
export async function saveLiveEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return publishEvent(_prev, formData);
}

export async function unpublishEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  return run('content.publish', async ({ db, staff }) => {
    const summary = (await getSalesSummaries([id])).get(id);
    if (summary && summary.ordersCount > 0) {
      return {
        ok: false,
        message: `${summary.ordersCount} ${summary.ordersCount === 1 ? 'person has' : 'people have'} paid for this event, so it cannot just come off the website. Cancel the event instead: everyone is refunded and told.`,
      };
    }
    await publishDirect(db, 'event_occurrences', id, { published: false }, staff);
    return done('Taken off the website. Nothing was deleted.', 'events');
  });
}

/* -------------------------------------------------------------- flyer -- */

/**
 * The flyer, first. Uploaded through the media library so it is a record
 * like every other picture, converted to a web-optimised copy on the way,
 * and its dominant colour stashed on the event for the page's surface tint.
 */
export async function uploadFlyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const accent = String(formData.get('accentHint') ?? '');
  const file = formData.get('file');
  return run('content.edit', async ({ db, staff }) => {
    const row = await db.get<Row>('event_occurrences', id);
    if (!row) return { ok: false, message: 'That event no longer exists.' };
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a picture first.' };
    const title = String(row.title || 'New event');
    const stored = await storeMediaFile({ db, staff, file, title: `${title} — flyer`, alt: `Official flyer for ${title}`, tags: ['Events'] });
    if (!stored.ok) return stored;
    await db.update('event_occurrences', id, {
      flyer_asset_id: stored.assetId,
      accent_hint: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : null,
    });
    return saved('Flyer saved.');
  });
}

/* -------------------------------------------------------------- tiers -- */

const tierSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200),
  priceCents: z.number().int().min(0).max(1_000_000),
  capacity: z.number().int().min(0).nullable(),
  maxPerOrder: z.number().int().min(1).max(50),
  seatsPerTicket: z.number().int().min(1).max(20),
  salesStartAt: z.string().max(40).nullable(),
  salesEndAt: z.string().max(40).nullable(),
  isActive: z.boolean(),
});

export type EditorTier = z.infer<typeof tierSchema>;

/**
 * Save the ticket types. New rows get a real id; removed rows are deleted
 * when nothing has been sold on them and retired (inactive) otherwise, so an
 * order's snapshot always has a tier to point at.
 */
export async function saveTiers(eventId: string, raw: unknown): Promise<{ ok: boolean; message: string; ids?: Record<string, string> }> {
  const parsed = z.array(tierSchema).max(12).safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Check the ticket types.' };
  return run('content.publish', async ({ db }) => {
    const existing = await db.list<Row>('ticket_tiers', { where: { event_id: eventId } });
    const keep = new Set<string>();
    const ids: Record<string, string> = {};
    let sort = 0;
    for (const tier of parsed.data) {
      const isNew = tier.id.startsWith('new-');
      const id = isNew ? crypto.randomUUID() : tier.id;
      ids[tier.id] = id;
      keep.add(id);
      const row: Row = {
        id,
        event_id: eventId,
        name: tier.name,
        description: tier.description || null,
        price_cents: tier.priceCents,
        capacity: tier.capacity,
        seats_per_ticket: tier.seatsPerTicket,
        min_per_order: 0,
        max_per_order: tier.maxPerOrder,
        sales_start_at: tier.salesStartAt || null,
        sales_end_at: tier.salesEndAt || null,
        sort_order: sort++,
        is_active: tier.isActive,
      };
      if (isNew) await db.insert('ticket_tiers', row);
      else await db.update('ticket_tiers', id, row);
    }
    for (const row of existing) {
      const id = String(row.id);
      if (keep.has(id)) continue;
      const sold = await db.list<Row>('order_items', { where: { tier_id: id }, limit: 1 });
      if (sold.length > 0) await db.update('ticket_tiers', id, { is_active: false });
      else await db.remove('ticket_tiers', id);
    }
    return { ok: true, message: 'Ticket types saved.', ids } as ActionState & { ids: Record<string, string> };
  }) as Promise<{ ok: boolean; message: string; ids?: Record<string, string> }>;
}

/* -------------------------------------------------------------- promos -- */

const promoSchema = z.object({
  code: z.string().trim().min(2).max(40),
  kind: z.enum(['percent', 'amount']),
  value: z.number().int().min(1).max(100_000),
  maxRedemptions: z.number().int().min(1).nullable(),
  endsAt: z.string().max(40).nullable(),
});

export async function addPromoCode(eventId: string, raw: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = promoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Check the code, the amount and the limit.' };
  if (parsed.data.kind === 'percent' && parsed.data.value > 100) return { ok: false, message: 'A percentage cannot be over 100.' };
  return run('content.publish', async ({ db }) => {
    await db.insert('promo_codes', {
      id: crypto.randomUUID(),
      code: parsed.data.code.toUpperCase(),
      event_id: eventId,
      kind: parsed.data.kind,
      value: parsed.data.value,
      max_redemptions: parsed.data.maxRedemptions,
      redeemed_count: 0,
      starts_at: null,
      ends_at: parsed.data.endsAt || null,
      is_active: true,
    });
    return { ok: true, message: `${parsed.data.code.toUpperCase()} added.` };
  });
}

export async function retirePromoCode(id: string): Promise<{ ok: boolean; message: string }> {
  return run('content.publish', async ({ db }) => {
    await db.update('promo_codes', id, { is_active: false });
    return { ok: true, message: 'Code switched off.' };
  });
}

/* ---------------------------------------------------- delete and cancel -- */

export async function deleteEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  return run('content.archive', async ({ db }) => {
    const summary = (await getSalesSummaries([id])).get(id);
    if (summary && summary.ordersCount > 0) {
      return { ok: false, message: 'People have paid for this event, so it cannot be deleted. Cancel it instead.' };
    }
    await db.remove('event_occurrences', id);
    return done('Deleted.', 'events');
  });
}

/**
 * Cancel: refund every paid order at Stripe (door orders are marked), void
 * every ticket, email everyone, and keep the record. Never a delete.
 */
export async function cancelEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  return run('content.publish', async ({ db, staff }) => {
    if (!staffCan(staff, 'content.publish')) return { ok: false, message: 'Only a manager or the owner can cancel an event.' };
    const row = await db.get<Row>('event_occurrences', id);
    if (!row) return { ok: false, message: 'That event no longer exists.' };
    const client = getTicketingClient();
    let refunded = 0;
    let failed = 0;
    const affectedOrderIds: string[] = [];
    if (client) {
      const { data: orders } = await client.from('orders').select('id, order_number, stripe_payment_intent_id, total_cents, status').eq('event_id', id).in('status', ['paid', 'partially_refunded']);
      const stripe = getStripe();
      for (const order of orders ?? []) {
        affectedOrderIds.push(String(order.id));
        if (order.stripe_payment_intent_id && stripe) {
          try {
            await stripe.refunds.create({ payment_intent: String(order.stripe_payment_intent_id) }, { idempotencyKey: `cancel-${order.id}` });
            refunded += 1;
          } catch {
            failed += 1;
          }
        } else {
          await client.from('orders').update({ status: 'refunded', refunded_cents: order.total_cents, notes: 'Event cancelled' }).eq('id', order.id);
          await client.from('tickets').update({ status: 'void' }).eq('order_id', order.id);
          refunded += 1;
        }
      }
      // Card refunds finish through the webhook; mark the tickets void now so
      // nothing scans green in the meantime.
      await client.from('tickets').update({ status: 'void' }).eq('event_id', id).neq('status', 'checked_in');
    }
    await publishDirect(db, 'event_occurrences', id, { status: 'cancelled' }, staff);
    // Every ticket holder hears it once, from here. With guest delivery
    // switched off each attempt is logged as skipped, so the Communications
    // screen shows exactly who still has to be told.
    const told = affectedOrderIds.length > 0 ? await emailService.sendEventUpdate(id, { kind: 'cancelled', message: String(formData.get('message') ?? '').trim() || null, onlyOrderIds: affectedOrderIds }) : null;
    await emailService.sendOwnerAlert(
      `${row.title} cancelled`,
      `${refunded} orders refunded${failed ? `, ${failed} could not be refunded — check Stripe` : ''}. Cancellation emails: ${told ? `${told.sent} sent, ${told.skipped} skipped, ${told.failed} failed` : 'none to send'}.`,
    );
    return done(
      `Cancelled. ${refunded} ${refunded === 1 ? 'order is' : 'orders are'} being refunded${failed ? `; ${failed} need a look in Stripe` : ''}.${told ? ` ${told.sent} ${told.sent === 1 ? 'guest' : 'guests'} emailed${told.skipped ? `, ${told.skipped} skipped (see Communications)` : ''}.` : ''} The event stays on the website marked cancelled.`,
      'events',
    );
  });
}

/* ---------------------------------------------------------- duplicate -- */

/**
 * A ready-to-edit copy: tiers, policies and copy carried over; the date, the
 * flyer and the sales cleared. The single feature that saves the most time.
 */
export async function duplicateEventFull(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  return run('content.edit', async ({ db, staff }) => {
    const row = await db.get<Row>('event_occurrences', id);
    if (!row || row.series_slug) return { ok: false, message: 'Choose an event to duplicate.' };
    const copyId = crypto.randomUUID();
    const { created_at: _c, updated_at: _u, updated_by: _b, draft: _d, ...content } = row;
    void _c; void _u; void _b; void _d;
    await db.insert('event_occurrences', {
      ...content,
      id: copyId,
      slug: `event-${copyId.slice(0, 8)}`,
      title: `${row.title ?? 'Event'} (copy)`,
      starts_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 14 * 86_400_000 + 3 * 3_600_000).toISOString(),
      doors_open_at: null,
      published: false,
      archived_at: null,
      status: 'scheduled',
      flyer_asset_id: null,
      accent_hint: null,
      ticket_url: null,
      source: 'manual',
      source_event_id: null,
      source_url: null,
      synced_at: null,
      featured: false,
      treatment: 'standard',
      takeover_start_at: null,
      takeover_end_at: null,
      reminder_sent_at: null,
      updated_by: staff.source === 'supabase' ? staff.id : null,
    });
    for (const tier of await db.list<Row>('ticket_tiers', { where: { event_id: id } })) {
      const { id: _id, created_at: _ca, ...rest } = tier;
      void _id; void _ca;
      await db.insert('ticket_tiers', { ...rest, id: crypto.randomUUID(), event_id: copyId });
    }
    return { ok: true, message: copyId };
  });
}
