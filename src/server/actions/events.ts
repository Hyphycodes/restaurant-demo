'use server';

import { z } from 'zod';
import { isFreeHouseNight } from '@/content/admission';
import type { Row } from '@/lib/db/types';
import { venueIsoDate, venueLocalIso } from '@/lib/events';
import { registerDirectMedia, storeMediaFile } from '@/server/media-files';
import { staffCan } from '../auth';
import { archive, publishDirect, saveDraft } from '../content/editorial';
import { done, run, saved, type ActionState } from './shared';

/**
 * Event mutations.
 *
 * The shape of this file follows the shape of the data: a series carries the
 * defaults, and an occurrence row exists only when one night differs. So there is
 * no "create the next twelve Fridays" action — the dates are generated — and
 * instead there is "make this one night different", which is the thing a
 * restaurant actually does.
 */

const httpsUrl = z
  .string()
  .trim()
  .refine((value) => !value || /^https:\/\/\S+$/i.test(value), {
    message: 'A ticket link has to start with https://',
  });

const dateInput = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Pick a valid date.');
const timeInput = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time like 22:00.');
const ageInput = z.string().trim().refine((value) => value === '' || /^\d{1,2}$/.test(value), 'Use an age from 0 to 99.');

/* ------------------------------------------------------------------ series */

const seriesSchema = z.object({
  slug: z.string().min(1),
  title: z.string().trim().min(1, 'The night needs a name.').max(120),
  summary: z.string().trim().max(200),
  description: z.string().trim().max(1200),
  ageMin: ageInput,
  ageNote: z.string().trim().max(120),
  music: z.string().trim().max(200),
  price: z.string().trim().max(12),
  weekday: z.coerce.number().int().min(0).max(6),
  seriesEndsOn: dateInput.or(z.literal('')),
  ticketUrl: httpsUrl,
  ticketPolicy: z.enum(['required', 'door', 'free', 'later']),
  flyerAssetId: z.string().trim().optional(),
  flyerPrintedDate: z.string().trim().max(60).optional(),
  startTime: timeInput,
  endTime: timeInput,
  publish: z.string().optional(),
});

function minutesOf(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export async function saveSeries(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = seriesSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: issue?.message ?? 'Please check the form.' };
    }

    const value = parsed.data;
    const start = minutesOf(value.startTime);
    let end = minutesOf(value.endTime);
    // A close time at or before the door time means it closes after midnight,
    // which is the normal case here — 10pm to 2am.
    if (end <= start) end += 1440;

    const price = value.price.replace(/[$,\s]/g, '');
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return { ok: false, message: 'Enter the entry price as a number, for example 10.' };
    }

    const fields: Row = {
      title: value.title,
      summary: value.summary,
      description: value.description,
      age_min: value.ageMin ? Number(value.ageMin) : null,
      age_note: value.ageNote || null,
      music_formats: value.music.split(',').map((s) => s.trim()).filter(Boolean),
      price_cents: isFreeHouseNight(value.slug) ? 0 : price ? Math.round(Number(price) * 100) : null,
      ticket_policy: isFreeHouseNight(value.slug) ? 'free' : value.ticketPolicy,
      ticket_url: isFreeHouseNight(value.slug) ? null : value.ticketUrl || null,
      cadence: `weekly:${value.weekday}`,
      series_ends_on: value.seriesEndsOn || null,
      start_minutes: start,
      end_minutes: end,
    };

    if (value.flyerAssetId !== undefined) {
      const chosen = value.flyerAssetId || null;
      if (chosen) {
        const asset = await db.get<Row>('media_assets', chosen);
        if (!asset?.path) return { ok: false, message: 'Pick a photo that has a file.' };
        // A flyer with a date printed into it has to declare that date, so the
        // public page can caption it instead of showing two dates and letting a
        // guest work out which one to believe.
        fields.flyer_printed_date = value.flyerPrintedDate?.trim() || null;
      } else {
        fields.flyer_printed_date = null;
      }
      fields.flyer_asset_id = chosen;
    }

    const wantsPublish = value.publish === 'true' && staffCan(staff, 'content.publish');
    if (wantsPublish) {
      await publishDirect(db, 'event_series', value.slug, fields, staff);
      return done(`${value.title} updated. Every future date uses these details.`, 'events');
    }

    await saveDraft(db, 'event_series', value.slug, fields, staff);
    return saved('Saved as a draft. A manager needs to publish it.');
  });
}

const pauseSchema = z.object({ slug: z.string().min(1), paused: z.enum(['true', 'false']) });

/**
 * Pausing stops generating future dates without losing the series or its history —
 * the honest way to say "we are not running this at the moment".
 */
export async function setSeriesPaused(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = pauseSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not change that.' };

    const paused = parsed.data.paused === 'true';
    await publishDirect(db, 'event_series', parsed.data.slug, { paused }, staff);
    return done(
      paused
        ? 'Paused. No new dates will appear on the website until you start it again.'
        : 'Running again. Future dates are back on the website.',
      'events',
    );
  });
}

/* -------------------------------------------------------------- occurrence */

const overrideSchema = z.object({
  seriesSlug: z.string().min(1),
  date: dateInput,
  status: z.enum(['scheduled', 'sold-out', 'cancelled', 'postponed', 'free']),
  ticketUrl: httpsUrl,
  price: z.string().trim().max(12),
  flyerAssetId: z.string().trim().max(60),
  title: z.string().trim().max(120),
  note: z.string().trim().max(300),
});

/**
 * Make one night different.
 *
 * A blank field means "use the series default", which is why every value is
 * written as null rather than as an empty string — an empty string would be an
 * override that says "nothing", and the night would lose its music or its name.
 */
export async function saveOccurrence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
    }

    const value = parsed.data;
    const price = value.price.replace(/[$,\s]/g, '');
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return { ok: false, message: 'Enter the entry price as a number, for example 10.' };
    }

    const series = await db.get<Row>('event_series', value.seriesSlug);
    if (!series) return { ok: false, message: 'That repeating night no longer exists.' };
    const existing = (await db.list<Row>('event_occurrences', { where: { series_slug: value.seriesSlug } }))
      .find((row) => (String(row.starts_at).length === 10 ? String(row.starts_at) : venueIsoDate(String(row.starts_at))) === value.date);
    const id = String(existing?.id ?? crypto.randomUUID());
    const [year, month, day] = value.date.split('-').map(Number);
    const start = venueLocalIso(year!, month!, day!, Number(series.start_minutes));
    const end = venueLocalIso(year!, month!, day!, Number(series.end_minutes));
    const fields: Row = {
      ...existing,
      id,
      series_slug: value.seriesSlug,
      starts_at: start,
      ends_at: end,
      status: value.status,
      ticket_url: value.ticketUrl || null,
      price_cents: price ? Math.round(Number(price) * 100) : null,
      flyer_asset_id: value.flyerAssetId || null,
      title: value.title || null,
      note: value.note || null,
      published: true,
      draft: null,
      archived_at: null,
    };

    // Nothing left to override: drop the row so the night goes back to being a
    // plain generated date with no record attached at all.
    const empty =
      value.status === 'scheduled' &&
      !value.ticketUrl &&
      !price &&
      !value.flyerAssetId &&
      !value.title &&
      !value.note;

    if (empty) {
      await db.remove('event_occurrences', id);
      return done('This night is back to the usual details.', 'events');
    }

    await db.upsert('event_occurrences', fields);
    return done(
      value.status === 'cancelled'
        ? 'This night is marked cancelled. Every other date is unchanged.'
        : 'Saved for this night only.',
      'events',
    );
  });
}

const clearSchema = z.object({ id: z.string().min(1) });

export async function clearOccurrence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = clearSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not reset that night.' };
    await db.remove('event_occurrences', parsed.data.id);
    return done('Back to the usual details for that night.', 'events');
  });
}

/**
 * Paste a list of ticket links, one per line, as `YYYY-MM-DD https://…`.
 *
 * Typing twelve links into twelve inputs is the kind of task people stop doing,
 * and stale ticket links are worse than none.
 */
const bulkSchema = z.object({
  seriesSlug: z.string().min(1),
  lines: z.string().max(4000),
});

export async function setTicketLinks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = bulkSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not read that list.' };

    const problems: string[] = [];
    let applied = 0;

    for (const raw of parsed.data.lines.split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      const match = /^(\d{4}-\d{2}-\d{2})[\s,]+(\S+)$/.exec(line);
      if (!match) {
        problems.push(`Could not read: “${line}”`);
        continue;
      }
      const [, date, url] = match;
      if (!/^https:\/\//i.test(url!)) {
        problems.push(`${date}: a ticket link has to start with https://`);
        continue;
      }

      if (!dateInput.safeParse(date).success) { problems.push(`${date}: invalid date`); continue; }
      const series = await db.get<Row>('event_series', parsed.data.seriesSlug);
      if (!series) return { ok: false, message: 'That repeating night no longer exists.' };
      const existing = (await db.list<Row>('event_occurrences', { where: { series_slug: parsed.data.seriesSlug } }))
        .find(row => (String(row.starts_at).length === 10 ? String(row.starts_at) : venueIsoDate(String(row.starts_at))) === date);
      const [y, m, d] = date!.split('-').map(Number);
      await db.upsert('event_occurrences', {
        ...(existing ?? {
          id: crypto.randomUUID(), series_slug: parsed.data.seriesSlug,
          starts_at: venueLocalIso(y!, m!, d!, Number(series.start_minutes)),
          ends_at: venueLocalIso(y!, m!, d!, Number(series.end_minutes)),
          status: 'scheduled', published: true,
        }),
        ticket_url: url,
      });
      applied += 1;
    }

    if (applied === 0) {
      return { ok: false, message: problems[0] ?? 'Nothing to add. Use: 2026-08-21 https://…' };
    }

    const message = `${applied} ticket ${applied === 1 ? 'link' : 'links'} saved.`;
    return problems.length
      ? saved(`${message} ${problems.length} line(s) skipped: ${problems[0]}`)
      : done(message, 'events');
  });
}

/* ---------------------------------------------------------- one-time event */

const oneTimeSchema = z.object({
  title: z.string().trim().min(1, 'Give the event a name.').max(120),
  date: dateInput,
  startTime: timeInput,
  endTime: timeInput,
  description: z.string().trim().max(1200),
  ageMin: ageInput,
  music: z.string().trim().max(200),
  price: z.string().trim().max(12),
  ticketUrl: httpsUrl,
  flyerAssetId: z.string().trim().optional(),
  publish: z.string().optional(),
});

const directArtworkSchema = z.object({
  uploadedUrl: z.string().url(),
  uploadedMime: z.string().min(1),
  uploadedSize: z.coerce.number().int().nonnegative(),
  uploadedOriginalName: z.string().min(1).max(255),
  uploadedWidth: z.coerce.number().int().nonnegative(),
  uploadedHeight: z.coerce.number().int().nonnegative(),
});

/**
 * A one-time event can be added to the website immediately or saved for later.
 */
export async function createOneTimeEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = oneTimeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
    }

    const value = parsed.data;
    const startsAt = venueInstant(value.date, value.startTime);
    let endsAt = venueInstant(value.date, value.endTime);
    // An end time before the start means the night runs past midnight.
    if (new Date(endsAt) <= new Date(startsAt)) {
      const next = new Date(new Date(value.date).getTime() + 86_400_000).toISOString().slice(0, 10);
      endsAt = venueInstant(next, value.endTime);
    }

    const price = value.price.replace(/[$,\s]/g, '');
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return { ok: false, message: 'Enter the entry price as a number, for example 25.' };
    }
    const slug = value.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    let flyerAssetId = value.flyerAssetId || null;
    const artwork = formData.get('artworkFile');
    const directArtwork = directArtworkSchema.safeParse(Object.fromEntries(formData));
    if (directArtwork.success) {
      const uploaded = await registerDirectMedia({
        db,
        staff,
        upload: {
          url: directArtwork.data.uploadedUrl,
          mime: directArtwork.data.uploadedMime,
          size: directArtwork.data.uploadedSize,
          originalName: directArtwork.data.uploadedOriginalName,
          width: directArtwork.data.uploadedWidth,
          height: directArtwork.data.uploadedHeight,
        },
        title: `${value.title} artwork`,
        alt: `Artwork for ${value.title}`,
        tags: ['Events'],
      });
      if (!uploaded.ok) return uploaded;
      flyerAssetId = uploaded.assetId;
    } else if (artwork instanceof File && artwork.size > 0) {
      const uploaded = await storeMediaFile({
        db,
        staff,
        file: artwork,
        title: `${value.title} artwork`,
        alt: `Artwork for ${value.title}`,
        tags: ['Events'],
      });
      if (!uploaded.ok) return uploaded;
      flyerAssetId = uploaded.assetId;
    } else if (flyerAssetId) {
      const asset = await db.get<Row>('media_assets', flyerAssetId);
      if (!asset?.path || asset.kind !== 'image') {
        return { ok: false, message: 'Choose an event picture that is available.' };
      }
    }

    const publish = value.publish === 'true' && staffCan(staff, 'content.publish');
    if (publish && !flyerAssetId) {
      return { ok: false, message: 'Choose an event picture before adding it to the website.' };
    }

    await db.insert('event_occurrences', {
      id: crypto.randomUUID(),
      series_slug: null,
      slug: `${slug}-${value.date}`,
      title: value.title,
      description: value.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'scheduled',
      age_min: value.ageMin ? Number(value.ageMin) : null,
      music_formats: value.music.split(',').map((s) => s.trim()).filter(Boolean),
      price_cents: price ? Math.round(Number(price) * 100) : null,
      ticket_url: value.ticketUrl || null,
      flyer_asset_id: flyerAssetId,
      published: publish,
      draft: null,
      archived_at: null,
    });

    return publish
      ? done(`“${value.title}” is on the website.`, 'events')
      : saved(`“${value.title}” is saved for later.`);
  });
}

/** A venue-local wall clock time as an instant, DST included. */
function venueInstant(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return venueLocalIso(year!, month!, day!, hour! * 60 + minute!);
}

const publishOccurrenceSchema = z.object({ id: z.string().min(1), published: z.enum(['true', 'false']) });

export async function setOccurrencePublished(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = publishOccurrenceSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not change that.' };

    const published = parsed.data.published === 'true';
    await db.update('event_occurrences', parsed.data.id, { published });
    return done(
      published ? 'Published. It is on the website now.' : 'Taken off the website.',
      'events',
    );
  });
}

export async function archiveOccurrence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.archive', async ({ db, staff }) => {
    const parsed = clearSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not archive that.' };
    await archive(db, 'event_occurrences', parsed.data.id, staff);
    return done('Archived. It is off the website but kept in your history.', 'events');
  });
}

export { venueIsoDate };

/* ------------------------------------------------------- one-off events */

const oneOffSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, 'The event needs a name.').max(120),
  summary: z.string().trim().max(200),
  description: z.string().trim().max(1200),
  date: dateInput,
  startTime: timeInput,
  endTime: timeInput,
  ticketUrl: httpsUrl,
  status: z.enum(['scheduled', 'sold-out', 'cancelled', 'postponed', 'free']),
  ageMin: ageInput,
  price: z.string().trim().max(12),
  music: z.string().trim().max(200),
  venueName: z.string().trim().max(120),
  publish: z.string().optional(),
});

/**
 * Edit one special event.
 *
 * Only the facts. The artwork columns are absent from the patch on purpose —
 * including `flyer_asset_id`, so no amount of editing the date can lose the
 * event's official flyer. Artwork is changed in its own place, deliberately.
 */
export async function saveOneTimeEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = oneOffSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
    }
    const value = parsed.data;

    const existing = await db.get<Row>('event_occurrences', value.id);
    if (!existing) return { ok: false, message: 'That event no longer exists.' };

    const [y, m, d] = value.date.split('-').map(Number);
    const startMinutes = minutesOf(value.startTime);
    let endMinutes = minutesOf(value.endTime);
    // A finish before the start means it runs past midnight, which is normal.
    if (endMinutes <= startMinutes) endMinutes += 1440;

    const price = value.price.replace(/[$,\s]/g, '');
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) return { ok: false, message: 'Enter a valid entry price.' };
    const fields: Row = {
      price_cents: price ? Math.round(Number(price) * 100) : null,
      music_formats: value.music.split(',').map((part) => part.trim()).filter(Boolean),
      title: value.title,
      summary: value.summary || null,
      description: value.description || null,
      starts_at: venueLocalIso(y!, m!, d!, startMinutes),
      ends_at: venueLocalIso(y!, m!, d!, endMinutes),
      ticket_url: value.ticketUrl || null,
      status: value.status,
      age_min: value.ageMin ? Number(value.ageMin) : null,
      venue_name: value.venueName || null,
    };

    const wantsPublish = value.publish === 'true' && staffCan(staff, 'content.publish');
    if (wantsPublish) {
      await publishDirect(db, 'event_occurrences', value.id, { ...fields, published: true }, staff);
      return done(`${value.title} is on the website.`, 'events', [`/events/${existing.slug ?? ''}`]);
    }

    await saveDraft(db, 'event_occurrences', value.id, fields, staff);
    return saved('Saved as a draft. A manager needs to publish it.');
  });
}

/** Duplicate as an unpublished manual event; never reuse another night's tickets. */
export async function duplicateEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const id = String(formData.get('id') ?? '');
    const row = await db.get<Row>('event_occurrences', id);
    if (!row || row.series_slug) return { ok: false, message: 'Choose a one-time event to duplicate.' };
    const copyId = crypto.randomUUID();
    const { created_at: _created, updated_at: _updated, updated_by: _by, ...content } = row;
    void _created; void _updated; void _by;
    await db.insert('event_occurrences', { ...content, id: copyId, slug: `event-${copyId}`, title: `${row.title} (copy)`, published: false, archived_at: null, draft: null, ticket_url: null, source: 'manual', source_event_id: null, source_url: null, synced_at: null, featured: false, treatment: 'standard', takeover_start_at: null, takeover_end_at: null });
    return done('Copy saved in Drafts. Set its date, flyer and ticket link before publishing.', 'events');
  });
}

export async function createSeries(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = z.object({ title: z.string().trim().min(1).max(120), weekday: z.coerce.number().int().min(0).max(6), startTime: timeInput, endTime: timeInput }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the times.' };
    const value = parsed.data;
    const start = minutesOf(value.startTime);
    const end = minutesOf(value.endTime);
    await db.insert('event_series', { slug: `weekly-${crypto.randomUUID().slice(0, 8)}`, title: value.title, summary: '', description: '', cadence: `weekly:${value.weekday}`, start_minutes: start, end_minutes: end <= start ? end + 1440 : end, paused: true, sort: Date.now() % 1000000, ticket_policy: 'later' });
    return done('Repeating night created and paused. Fill in the details, then start it from Repeating nights.', 'events');
  });
}
