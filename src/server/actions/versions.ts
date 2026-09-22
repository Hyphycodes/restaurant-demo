'use server';

import { z } from 'zod';
import { publishDraft, restoreVersion } from '../content/editorial';
import { getMedia, routesOfRegistryUsage } from '../content/media';
import { done, run, saved, type ActionState } from './shared';

/**
 * Records with no review step of their own.
 *
 * A photograph is edited live — there is no "publish this photo" button, because
 * a description or a crop is not something you stage. Restoring one as a draft
 * would therefore park it somewhere with no way to let it out, so for these the
 * restore is applied immediately. Everything else comes back as a draft.
 */
const RESTORE_IMMEDIATELY = new Set(['media_assets']);

/**
 * Restore an earlier version.
 *
 * It comes back as a DRAFT, never straight onto the website. Restoring is an edit
 * like any other and gets the same look before it goes live — and a restore made
 * by mistake then costs nothing to undo.
 */
const schema = z.object({
  table: z.string().min(1),
  id: z.string().min(1),
  versionId: z.string().min(1),
});

export async function restoreVersionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.restore', async ({ db, staff }) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not restore that version.' };

    const fields = await restoreVersion(
      db,
      parsed.data.table,
      parsed.data.id,
      parsed.data.versionId,
      staff,
    );

    if (fields.length === 0) {
      return saved('That version matches what is live — nothing to change.');
    }

    if (RESTORE_IMMEDIATELY.has(parsed.data.table)) {
      await publishDraft(db, parsed.data.table, parsed.data.id, staff);
      const entry = await getMedia(db, parsed.data.id);
      const routes = [
        ...(entry?.usage ?? []).map((use) => use.route),
        ...routesOfRegistryUsage(entry?.registryUsage ?? []),
      ];
      return done('Put back. The website is showing it again now.', 'media', routes);
    }

    return saved(`Brought back as a draft (${fields.length} ${fields.length === 1 ? 'field' : 'fields'}). Look it over, then publish.`);
  });
}
