'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Row } from '@/lib/db/types';
import { staffCan } from '../auth';
import { publishDirect, saveDraft } from '../content/editorial';
import { done, revalidate, run, saved, type ActionState } from './shared';

/**
 * The Website section.
 *
 * Staff edit the words and the photograph in a slot the design already has.
 * There is no action here that creates a section, reorders a page or accepts
 * markup — the absence of those is the product decision, not an omission.
 */

const sectionSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().trim().max(60),
  heading: z.string().trim().min(1, 'A section needs a heading.').max(140),
  body: z.string().trim().max(700),
  mediaAssetId: z.string().trim().max(60),
  visible: z.coerce.boolean(),
  publish: z.string().optional(),
});

export async function saveSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = sectionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: issue?.message ?? 'Please check the form.' };
    }

    const value = parsed.data;
    const fields: Row = {
      eyebrow: value.eyebrow || null,
      heading: value.heading,
      body: value.body || null,
      media_asset_id: value.mediaAssetId || null,
      visible: value.visible,
    };

    const page = value.id.split(':')[0] ?? 'home';
    const route = page === 'home' ? '/' : `/${page}`;

    if (value.publish === 'true' && staffCan(staff, 'content.publish')) {
      await publishDirect(db, 'page_sections', value.id, fields, staff);
      // The page's own route, plus the homepage when the homepage references it.
      revalidate(page === 'home' ? 'home' : 'media');
      revalidatePath(route);
      revalidatePath('/admin', 'layout');
      return { ok: true, message: 'Published. It is on the website now.', affected: [route] };
    }

    await saveDraft(db, 'page_sections', value.id, fields, staff);
    return saved(
      staffCan(staff, 'content.publish')
        ? 'Saved as a draft. Preview it, then publish when you are happy.'
        : 'Saved as a draft. A manager needs to publish it.',
    );
  });
}

/**
 * The safe editable lists: enquiry choices, perks, positions.
 *
 * Only the visible options are editable. Field names, validation, spam
 * protection, privacy copy and where a submission is delivered are not touched
 * by anything in this file.
 */
const listSchema = z.object({
  id: z.string().min(1),
  items: z.string().max(3000),
  publish: z.string().optional(),
});

export async function saveList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    const parsed = listSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not save that list.' };

    const items = parsed.data.items
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (items.length === 0) {
      return { ok: false, message: 'Keep at least one option — an empty list breaks the form.' };
    }
    if (new Set(items).size !== items.length) {
      return { ok: false, message: 'Two options are identical. Give each one a distinct name.' };
    }

    if (parsed.data.publish === 'true' && staffCan(staff, 'content.publish')) {
      await publishDirect(db, 'page_lists', parsed.data.id, { items }, staff);
      return done(`Saved ${items.length} options.`);
    }

    await saveDraft(db, 'page_lists', parsed.data.id, { items }, staff);
    return saved('Saved as a draft. A manager needs to publish it.');
  });
}
