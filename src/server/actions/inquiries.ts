'use server';

import { revalidatePath } from 'next/cache';
import { inquiryPlanSchema, inquiryStatusSchema, INQUIRY_STAGE_LABEL } from '@/lib/inquiry-pipeline';
import { getInquiry } from '@/server/content/inquiries';
import { run, saved, type ActionState } from './shared';

/**
 * Enquiries: a small private-events & catering pipeline.
 *
 * Two changes are possible, and only two: move an enquiry to another stage, and
 * write down the plan (next step, when to follow up, internal notes). Nothing
 * here changes where a submission is delivered or sends anything to the guest,
 * and there is no delete — an enquiry is a business record.
 */

function refresh(id: string) {
  revalidatePath('/admin/inquiries');
  revalidatePath(`/admin/inquiries/${id}`);
}

export async function updateInquiryStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('inquiries.manage', async ({ db }) => {
    const parsed = inquiryStatusSchema.safeParse({
      id: formData.get('id') ?? '',
      status: formData.get('status') ?? '',
    });
    if (!parsed.success) return { ok: false, message: 'Could not move that enquiry.' };

    const { id, status } = parsed.data;
    const inquiry = await getInquiry(db, id);
    if (!inquiry) return { ok: false, message: 'That enquiry no longer exists. Refresh the page.' };

    // Pressing the current stage again is not a change, and must not reset
    // "when it last moved".
    if (inquiry.status === status) {
      return { ok: true, message: `Already ${INQUIRY_STAGE_LABEL[status]}.` };
    }

    await db.update('inquiries', id, {
      status,
      status_changed_at: new Date().toISOString(),
    });

    refresh(id);
    return saved(`Moved to ${INQUIRY_STAGE_LABEL[status]}.`);
  });
}

export async function updateInquiryPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('inquiries.manage', async ({ db }) => {
    const parsed = inquiryPlanSchema.safeParse({
      id: formData.get('id') ?? '',
      nextStep: formData.get('nextStep') ?? '',
      followUpOn: formData.get('followUpOn') ?? '',
      notes: formData.get('notes') ?? '',
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message;
      return { ok: false, message: 'Check the highlighted field.', errors };
    }

    const { id, nextStep, followUpOn, notes } = parsed.data;
    if (!(await getInquiry(db, id))) {
      return { ok: false, message: 'That enquiry no longer exists. Refresh the page.' };
    }

    await db.update('inquiries', id, {
      next_step: nextStep || null,
      follow_up_on: followUpOn || null,
      notes: notes || null,
    });

    refresh(id);
    return saved('Saved.');
  });
}
