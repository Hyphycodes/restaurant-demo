'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { APPLICATION_STATUSES } from '@/content/careers';
import { run, saved, type ActionState } from './shared';

/**
 * Job openings and applicants.
 *
 * Two kinds of write, and they are not the same thing:
 *
 *   * an OPENING is content. Switching one on puts it on the website, so the
 *     public routes are revalidated and the change is audited (migration
 *     0026 puts the audit trigger on that table and not on the other two).
 *   * an APPLICATION is somebody's record. Staff move it along and leave a
 *     note for each other; nothing here changes what the applicant sent, and
 *     there is no delete — "Archived" is the end of the line.
 */

const CAREERS_ROUTES = ['/careers', '/contact'];

function refreshPublic(): void {
  for (const route of CAREERS_ROUTES) revalidatePath(route);
}

/* ------------------------------------------------------------- openings -- */

const openingSchema = z.object({
  id: z.string().trim().max(64).optional().or(z.literal('')),
  title: z.string().trim().min(1, 'Give the role a name.').max(80),
  summary: z.string().trim().max(280),
  employmentType: z.enum(['full_time', 'part_time', 'either', 'seasonal']),
  active: z.coerce.boolean(),
  sort: z.coerce.number().int().min(0).max(9999),
});

export async function saveOpening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const parsed = openingSchema.safeParse({
      id: formData.get('id') ?? '',
      title: formData.get('title') ?? '',
      summary: formData.get('summary') ?? '',
      employmentType: formData.get('employmentType') ?? 'either',
      active: formData.get('active') === 'true',
      sort: formData.get('sort') ?? 0,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Could not save that.' };
    }

    const patch = {
      title: parsed.data.title,
      summary: parsed.data.summary || null,
      employment_type: parsed.data.employmentType,
      active: parsed.data.active,
      sort: parsed.data.sort,
      archived_at: null,
    };

    if (parsed.data.id) {
      await db.update('job_openings', parsed.data.id, patch);
    } else {
      await db.insert('job_openings', { ...patch, created_at: new Date().toISOString() });
    }

    refreshPublic();
    revalidatePath('/admin', 'layout');
    return {
      ok: true,
      message: parsed.data.active ? 'Saved — it is on the website now.' : 'Saved. It is switched off, so nobody can see it.',
    };
  });
}

/** The switch on the list. One click, no form to open. */
export async function toggleOpening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const id = String(formData.get('id') ?? '');
    const active = formData.get('active') === 'true';
    if (!id) return { ok: false, message: 'Could not find that role.' };
    await db.update('job_openings', id, { active, archived_at: null });
    refreshPublic();
    revalidatePath('/admin', 'layout');
    return { ok: true, message: active ? 'On the website.' : 'Taken off the website.' };
  });
}

/**
 * Off the list for good, without losing the applications attached to it.
 *
 * Archive rather than delete: `job_applications.opening_id` points here, and
 * an application has to keep saying what it was for.
 */
export async function archiveOpening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.archive', async ({ db }) => {
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, message: 'Could not find that role.' };
    await db.update('job_openings', id, { active: false, archived_at: new Date().toISOString() });
    refreshPublic();
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Archived. Applications for it are still here.' };
  });
}

export async function restoreOpening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.archive', async ({ db }) => {
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, message: 'Could not find that role.' };
    await db.update('job_openings', id, { archived_at: null });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Back on the list, switched off.' };
  });
}

/* ---------------------------------------------------------- applicants -- */

const applicantSchema = z.object({
  id: z.string().min(1),
  status: z.enum(APPLICATION_STATUSES as [string, ...string[]]),
  staffNotes: z.string().trim().max(4000),
});

export async function updateApplicant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('inquiries.manage', async ({ db }) => {
    const parsed = applicantSchema.safeParse({
      id: formData.get('id') ?? '',
      status: formData.get('status') ?? 'new',
      staffNotes: formData.get('staffNotes') ?? '',
    });
    if (!parsed.success) return { ok: false, message: 'Could not save that change.' };

    await db.update('job_applications', parsed.data.id, {
      status: parsed.data.status,
      staff_notes: parsed.data.staffNotes || null,
    });

    revalidatePath('/admin/hiring');
    return saved('Saved.');
  });
}
