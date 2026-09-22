'use server';

import { z } from 'zod';
import {
  ART_SLOT_SPEC,
  EVENT_ART_SLOTS,
  isEventCategory,
  isEventTreatment,
  isVisualPreset,
  type EventArtSlot,
} from '@/content/event-presentation';
import type { Row } from '@/lib/db/types';
import { venueLocalIso } from '@/lib/events';
import { storeMediaFile } from '@/server/media-files';
import { reconcileTickeri } from '@/server/events/reconcile';
import { readTickeriCalendar } from '@/server/events/tickeri';
import { done, run, type ActionState } from './shared';

/**
 * How an event looks, and where its calendar comes from.
 *
 * Split from `events.ts` — which owns what an event IS — because these are two
 * different jobs done by two different people on two different days. Nothing
 * here can change a date, a price or a ticket link.
 *
 * THE FLYER RULE IS ENFORCED HERE. `flyer` is one of the artwork slots, but it
 * is the only one marked `official`, and the guard below refuses to overwrite a
 * flyer that already exists unless the form carries an explicit
 * `replaceOfficial=yes` — which only the admin's own "Replace the official
 * flyer" control sends, behind a confirmation. Key art can never touch it.
 */

/** Which table an event lives in. A recurring night is a series; a one-off is not. */
const targetSchema = z.object({
  table: z.enum(['event_series', 'event_occurrences']),
  id: z.string().min(1),
});

const presentationSchema = targetSchema.extend({
  category: z.string().trim().max(20),
  visualPreset: z.string().trim().max(20),
  treatment: z.string().trim().max(20),
  priority: z.string().trim().max(4),
  priceText: z.string().trim().max(120),
  takeoverStartDate: z.string().trim().max(10),
  takeoverStartTime: z.string().trim().max(5),
  takeoverEndDate: z.string().trim().max(10),
  takeoverEndTime: z.string().trim().max(5),
});

function instant(date: string, clock: string, fallback: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (/^\d{2}:\d{2}$/.test(clock) ? clock : fallback).split(':').map(Number);
  return venueLocalIso(y!, m!, d!, (hh ?? 0) * 60 + (mm ?? 0));
}

export async function saveEventPresentation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = presentationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Please check the form and try again.' };
    const value = parsed.data;

    if (value.visualPreset && !isVisualPreset(value.visualPreset)) {
      return { ok: false, message: 'Choose a look from the list.' };
    }
    if (!isEventTreatment(value.treatment)) {
      return { ok: false, message: 'Choose how prominent this event should be.' };
    }
    if (value.category && !isEventCategory(value.category)) {
      return { ok: false, message: 'Choose a kind of event from the list.' };
    }

    const takeoverStartAt =
      value.treatment === 'takeover'
        ? instant(value.takeoverStartDate, value.takeoverStartTime, '00:00')
        : null;
    const takeoverEndAt =
      value.treatment === 'takeover'
        ? instant(value.takeoverEndDate, value.takeoverEndTime, '23:59')
        : null;

    if (value.treatment === 'takeover') {
      if (!takeoverStartAt || !takeoverEndAt) {
        return {
          ok: false,
          message: 'A hero takeover needs both a start and an end date, so it can put itself back.',
        };
      }
      if (Date.parse(takeoverEndAt) <= Date.parse(takeoverStartAt)) {
        return { ok: false, message: 'The takeover has to end after it starts.' };
      }
    }

    const priority = Number(value.priority || 0);
    const patch: Row = {
      category: value.category || null,
      visual_preset: value.visualPreset || 'brass',
      treatment: value.treatment,
      featured: value.treatment !== 'standard',
      priority: Number.isFinite(priority) ? Math.max(0, Math.min(99, Math.round(priority))) : 0,
      price_text: value.priceText || null,
      takeover_start_at: takeoverStartAt,
      takeover_end_at: takeoverEndAt,
    };

    await db.update(value.table, value.id, patch);

    return done(
      value.treatment === 'takeover'
        ? 'Saved. This event takes over the homepage for the dates you set, then puts it back.'
        : value.treatment === 'featured'
          ? 'Saved. This event is in the running for the big slot on the homepage.'
          : 'Saved.',
      'events',
    );
  });
}

/* ------------------------------------------------------------------ artwork */

const artSchema = targetSchema.extend({
  slot: z.string().trim().max(20),
  /** Only the official-flyer control sends this. */
  replaceOfficial: z.string().trim().max(4).optional(),
});

const COLUMN: Record<EventArtSlot, string> = {
  flyer: 'flyer_asset_id',
  keyArt: 'key_art_asset_id',
  keyArtMobile: 'key_art_mobile_asset_id',
  foreground: 'foreground_asset_id',
};

function isArtSlot(value: string): value is EventArtSlot {
  return (EVENT_ART_SLOTS as readonly string[]).includes(value);
}

/**
 * Put a picture in one of an event's artwork slots.
 *
 * The official flyer is write-once from here: replacing one that already exists
 * takes a deliberate second action, because the flyer is the artwork the event
 * was really promoted with and losing it silently is not recoverable from the
 * website. Every other slot is website art and overwrites freely.
 */
export async function uploadEventArt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = artSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success || !isArtSlot(parsed.data.slot)) {
      return { ok: false, message: 'Could not tell which picture to change.' };
    }
    const { table, id, slot } = parsed.data;
    const spec = ART_SLOT_SPEC[slot];

    const current = await db.get<Row>(table, id);
    if (!current) return { ok: false, message: 'That event no longer exists.' };

    if (spec.official && current[COLUMN[slot]] && parsed.data.replaceOfficial !== 'yes') {
      return {
        ok: false,
        message:
          'This event already has its official flyer. Use “Replace the official flyer” if you really mean to change it — website key art goes in its own slot and leaves the flyer alone.',
      };
    }

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'Choose a picture to upload first.' };
    }

    const title = String(current.title ?? id);
    const stored = await storeMediaFile({
      db,
      staff,
      file,
      title: `${title} — ${spec.label.toLowerCase()}`,
      alt: spec.official ? `Official flyer for ${title}` : 'Decorative event artwork',
      tags: ['Events'],
    });
    if (!stored.ok) return stored;

    // Website art carries no information a screen reader needs; the flyer does,
    // because the event's own name and date are printed into it.
    if (!spec.official) {
      await db.update('media_assets', stored.assetId, { alt: null, decorative: true });
    }

    await db.update(table, id, { [COLUMN[slot]]: stored.assetId });
    return done(
      spec.official
        ? 'Official flyer saved. It is what guests see as this event’s artwork.'
        : `${spec.label} saved.`,
      'events',
    );
  });
}

/**
 * Take a picture out of a slot.
 *
 * Clearing the OFFICIAL flyer is refused: an event without its flyer has lost
 * the thing it was advertised as, and the file would still be in the library
 * with nothing pointing at it. Replace it instead.
 */
export async function clearEventArt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = artSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success || !isArtSlot(parsed.data.slot)) {
      return { ok: false, message: 'Could not tell which picture to remove.' };
    }
    const { table, id, slot } = parsed.data;
    if (ART_SLOT_SPEC[slot].official) {
      return {
        ok: false,
        message:
          'The official flyer cannot be removed — it is the event’s own artwork. You can replace it with a different one.',
      };
    }

    await db.update(table, id, { [COLUMN[slot]]: null });
    return done(`${ART_SLOT_SPEC[slot].label} removed. The official flyer is untouched.`, 'events');
  });
}

/* --------------------------------------------------------------- reconcile */

const syncSchema = z.object({
  publishNew: z.string().optional(),
  importFlyers: z.string().optional(),
});


export async function syncTickeri(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = syncSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not start the check.' };

    const read = await readTickeriCalendar();
    if (read.events.length === 0) {
      return {
        ok: false,
        message: `Nothing was changed. ${read.problems[0] ?? 'Tickeri listed no events we could read.'}`,
      };
    }

    const report = await reconcileTickeri(db, staff, read.events, {
      publishNew: parsed.data.publishNew === 'true',
      importFlyers: parsed.data.importFlyers !== 'false',
    });

    const created = report.changes.filter((c) => c.action === 'created');
    const updated = report.changes.filter((c) => c.action === 'updated');
    const flyers = report.changes.filter((c) => c.flyerImported).length;

    const parts: string[] = [];
    parts.push(
      created.length > 0
        ? `Added ${created.length} new ${created.length === 1 ? 'event' : 'events'}`
        : 'No new events',
    );
    if (updated.length > 0) {
      parts.push(`updated ${updated.length} (${updated[0]!.title}${updated.length > 1 ? ' and others' : ''})`);
    }
    if (flyers > 0) parts.push(`brought in ${flyers} official ${flyers === 1 ? 'flyer' : 'flyers'}`);
    if (report.missing.length > 0) {
      parts.push(
        `${report.missing.length} ${report.missing.length === 1 ? 'event is' : 'events are'} no longer listed on Tickeri — check ${report.missing.map((m) => m.title).slice(0, 3).join(', ')}`,
      );
    }
    if (report.problems.length > 0) parts.push(`${report.problems.length} could not be read`);

    return done(`${parts.join(' · ')}.`, 'events');
  });
}
