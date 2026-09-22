'use server';

import { z } from 'zod';
import type { Row } from '@/lib/db/types';
import { registerDirectMedia, storeMediaFile } from '@/server/media-files';
import { archive, publishDirect, unarchive } from '../content/editorial';
import { getMedia, routesOfRegistryUsage, usageOf } from '../content/media';
import { done, run, type ActionState } from './shared';

/**
 * Media.
 *
 * Two rules that are enforced here rather than left to whoever is uploading:
 *
 *  1. A meaningful image cannot be published without a description, and a
 *     decorative one has to be marked decorative on purpose. The database has the
 *     same constraint, so neither can be skipped by a direct API call.
 *  2. Nothing that is still in use can be archived without being shown, by name,
 *     where it is used. The reference list is a live query over the same rows the
 *     public site reads.
 */

const uploadSchema = z.object({
  title: z.string().trim().max(80),
  alt: z.string().trim().max(200),
  decorative: z.coerce.boolean(),
  tags: z.string().trim().max(200),
});

const directUploadSchema = z.object({
  uploadedUrl: z.string().url(),
  uploadedMime: z.string().min(1),
  uploadedSize: z.coerce.number().int().nonnegative(),
  uploadedOriginalName: z.string().min(1).max(255),
  uploadedWidth: z.coerce.number().int().nonnegative(),
  uploadedHeight: z.coerce.number().int().nonnegative(),
});

export async function uploadMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('media.upload', async ({ db, staff }) => {
    const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Please check the description.' };
    const value = parsed.data;

    const tags = value.tags ? value.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
    const direct = directUploadSchema.safeParse(Object.fromEntries(formData));
    const file = formData.get('file');
    const result = direct.success
      ? await registerDirectMedia({
          db,
          staff,
          upload: {
            url: direct.data.uploadedUrl,
            mime: direct.data.uploadedMime,
            size: direct.data.uploadedSize,
            originalName: direct.data.uploadedOriginalName,
            width: direct.data.uploadedWidth,
            height: direct.data.uploadedHeight,
          },
          title: value.title,
          alt: value.decorative ? 'Decorative media' : value.alt,
          tags,
        })
      : file instanceof File && file.size > 0
        ? await storeMediaFile({
            db,
            staff,
            file,
            title: value.title,
            alt: value.decorative ? 'Decorative media' : value.alt,
            tags,
          })
        : { ok: false as const, message: 'Choose a photo or video to upload.' };
    if (!result.ok) return result;
    if (value.decorative) {
      await db.update('media_assets', result.assetId, { alt: null, decorative: true });
    }
    return done(`Added “${result.title}”. It is ready to use.`, 'media');
  });
}

const repointSchema = z.object({
  assetId: z.string().min(1),
  replacementId: z.string().min(1),
});

/**
 * Point a design-placed slot at a different file.
 *
 * Most photographs on this website are not chosen by a staff member — they are
 * written into the layout as `<Asset id="dishPasta" />`, because the
 * composition is built around that shape and that focal point. There is no
 * reference row to repoint, so `replaceMedia` cannot touch them, and until now
 * the admin correctly said "swapping this is a job for your developer".
 *
 * It is not any more. The public site resolves every image through the media
 * record, so changing which FILE a slot points at changes the website. The slot
 * keeps its id, its crop and its place in the design; only the picture changes.
 *
 * The alt text comes across with the file, because a description that stays
 * behind describes the wrong photograph — the single most common way an image
 * swap breaks a screen reader.
 */
export async function repointMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = repointSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not swap that photo.' };
    const { assetId, replacementId } = parsed.data;

    if (assetId === replacementId) {
      return { ok: false, message: 'That is the photo already in this slot.' };
    }

    const [slot, replacement] = await Promise.all([
      db.get<Row>('media_assets', assetId),
      db.get<Row>('media_assets', replacementId),
    ]);
    if (!slot) return { ok: false, message: 'That slot no longer exists.' };
    if (!replacement?.path) return { ok: false, message: 'Pick a photo that has a file.' };

    if (replacement.kind !== slot.kind) {
      return {
        ok: false,
        message: `This slot holds a ${slot.kind}. Pick a ${slot.kind} to put in it.`,
      };
    }

    // Snapshot first. Repointing a slot replaces the only record of which file
    // used to be in it, so without this the swap would be one-way — and "put the
    // old photo back" is the first thing anyone asks for after a swap.
    await publishDirect(db, 'media_assets', assetId, {
      path: replacement.path,
      width: replacement.width,
      height: replacement.height,
      ratio: replacement.ratio,
      mime: replacement.mime,
      size_bytes: replacement.size_bytes,
      poster: replacement.poster ?? slot.poster ?? null,
      alt: replacement.decorative ? null : (replacement.alt ?? slot.alt),
      decorative: Boolean(replacement.decorative),
      status: 'final',
    }, staff);

    const entry = await getMedia(db, assetId);
    const routes = [
      ...(entry?.usage ?? []).map((use) => use.route),
      ...routesOfRegistryUsage(entry?.registryUsage ?? []),
    ];

    return done('Swapped. Every place that uses this photo now shows the new one.', 'media', routes);
  });
}

const detailsSchema = z.object({
  assetId: z.string().min(1),
  title: z.string().trim().max(80),
  alt: z.string().trim().max(200),
  decorative: z.coerce.boolean(),
  tags: z.string().trim().max(200),
  focal: z.string().trim().max(20),
});

export async function saveMediaDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not save that.' };
    const value = parsed.data;

    if (!value.decorative && !value.alt.trim()) {
      return {
        ok: false,
        message:
          'Add a short description of what the photo shows, or tick “decorative” if it carries no information.',
      };
    }

    await db.update('media_assets', value.assetId, {
      title: value.title,
      alt: value.decorative ? null : value.alt,
      decorative: value.decorative,
      tags: value.tags ? value.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      focal: /^\d{1,3}% \d{1,3}%$/.test(value.focal) ? value.focal : '50% 50%',
    });

    return done('Saved.', 'media');
  });
}

const archiveSchema = z.object({ assetId: z.string().min(1), confirm: z.string().optional() });

/**
 * Archiving a photo that is still on the website is refused, and the refusal
 * lists every place using it. Confirming does not force it through — it archives
 * only once the references are gone.
 */
export async function archiveMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.archive', async ({ db, staff }) => {
    const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not archive that.' };

    const entry = await getMedia(db, parsed.data.assetId);
    if (!entry) return { ok: false, message: 'That photo no longer exists.' };

    const usage = await usageOf(db, parsed.data.assetId);
    if (usage.length > 0) {
      const where = usage.map((use) => use.label).join(', ');
      return {
        ok: false,
        message: `Still in use in ${usage.length} ${usage.length === 1 ? 'place' : 'places'}: ${where}. Swap the photo there first, then archive this one.`,
      };
    }

    // Placements the design fixes — a component asking for this asset by name —
    // cannot be changed from here, so archiving would leave a hole on a page.
    if (entry.registryUsage.length > 0) {
      return {
        ok: false,
        message: `The design places this photo on ${entry.registryUsage.join(', ')}. Ask your developer to swap it there first — archiving it here would leave a gap.`,
      };
    }

    await archive(db, 'media_assets', parsed.data.assetId, staff);
    return done('Archived. The file is kept, it is just not offered any more.', 'media');
  });
}

export async function unarchiveMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.archive', async ({ db }) => {
    const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not restore that.' };
    await unarchive(db, 'media_assets', parsed.data.assetId);
    return done('Back in the library.', 'media');
  });
}

const replaceSchema = z.object({
  assetId: z.string().min(1),
  replacementId: z.string().min(1),
  scope: z.enum(['one', 'all']),
  /** For `one`: the record to change. */
  target: z.string().optional(),
});

/**
 * Swap a photo — in one place, or everywhere it appears.
 *
 * Asking which is not a nicety: "replace the homepage picture" and "replace this
 * picture everywhere" are different intentions, and guessing wrong silently
 * changes pages the person was not looking at.
 */
export async function replaceMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const parsed = replaceSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not swap that photo.' };
    const { assetId, replacementId, scope, target } = parsed.data;

    const replacement = await db.get<Row>('media_assets', replacementId);
    if (!replacement) return { ok: false, message: 'Pick a photo to use instead.' };

    let changed = 0;

    const swap = async (table: string, column: string, id: string) => {
      await db.update(table, id, { [column]: replacementId });
      changed += 1;
    };

    if (scope === 'one' && target) {
      const [table, column, id] = target.split('|');
      if (!table || !column || !id) return { ok: false, message: 'Could not swap that photo.' };
      await swap(table, column, id);
    } else {
      for (const row of await db.list<Row>('event_series')) {
        if (row.flyer_asset_id === assetId) await swap('event_series', 'flyer_asset_id', String(row.slug));
      }
      for (const row of await db.list<Row>('event_occurrences')) {
        if (row.flyer_asset_id === assetId) await swap('event_occurrences', 'flyer_asset_id', String(row.id));
      }
      for (const row of await db.list<Row>('page_sections')) {
        if (row.media_asset_id === assetId) await swap('page_sections', 'media_asset_id', String(row.id));
      }
      for (const row of await db.list<Row>('menu_items')) {
        if (row.media_asset_id === assetId) await swap('menu_items', 'media_asset_id', String(row.id));
      }
    }

    if (changed === 0) return { ok: false, message: 'Nothing was using that photo.' };
    return done(
      scope === 'one'
        ? 'Swapped in that one place. Everywhere else is unchanged.'
        : `Swapped in ${changed} ${changed === 1 ? 'place' : 'places'}.`,
      'media',
    );
  });
}
