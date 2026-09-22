'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { run, saved, type ActionState } from './shared';

/**
 * Enquiries.
 *
 * Deliberately small. This is not a CRM: staff mark where an enquiry has got to
 * and leave a note for each other. Nothing here changes where a submission is
 * delivered, and there is no delete — an enquiry is a business record.
 */
const schema = z.object({
  id: z.string().min(1),
  status: z.enum(['new', 'in-progress', 'closed']),
  notes: z.string().trim().max(2000),
});

export async function updateInquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('inquiries.manage', async ({ db }) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not save that change.' };

    await db.update('inquiries', parsed.data.id, {
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    });

    revalidatePath('/admin/inquiries');
    return saved('Saved.');
  });
}
