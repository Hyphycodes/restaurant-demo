'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { PRESETS, resolveLook, SEASONS, type Appearance } from '@/lib/appearance/presets';
import { APPEARANCE_TAG, appearanceToRow } from '@/server/appearance';
import { done, run, type ActionState } from './shared';

/**
 * Save the look. Nothing goes live until this runs; the preview in
 * /admin/look is inline variables in an iframe and touches no row.
 *
 * The same guardrails that run in the editor run here, so a colour that the
 * editor would have refused cannot be saved through a hand-made request.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal(''));
const schema = z.object({
  preset: z.enum(PRESETS),
  surfaceHex: hex,
  accentHex: hex,
  season: z.enum(SEASONS),
  decorationsEnabled: z.enum(['true', 'false']),
  decorationIntensity: z.enum(['subtle', 'lively']),
  adminFollowsSite: z.enum(['true', 'false']),
});

export async function saveAppearance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Please check the choices and try again.' };
    const value = parsed.data;

    const appearance: Appearance = {
      preset: value.preset,
      surfaceHex: value.surfaceHex ? value.surfaceHex.toLowerCase() : null,
      accentHex: value.accentHex ? value.accentHex.toLowerCase() : null,
      season: value.season,
      decorationsEnabled: value.decorationsEnabled === 'true',
      decorationIntensity: value.decorationIntensity,
      adminFollowsSite: value.adminFollowsSite === 'true',
    };
    const look = resolveLook(appearance);
    if (look.refused.length > 0) {
      return { ok: false, message: look.refused.map((entry) => entry.reason).join(' ') };
    }

    await db.upsert('appearance', appearanceToRow(appearance, staff.name || staff.email || null));
    revalidateTag(APPEARANCE_TAG);
    revalidatePath('/', 'layout');
    return done(
      look.notes.length ? `Saved. ${look.notes.join(' ')}` : 'Saved. The website has the new look.',
      'theme',
    );
  });
}
