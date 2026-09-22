'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { serviceTypeFor, TALENT_STATUSES, type TalentDiscipline } from '@/content/talent';
import { getTalent } from '@/server/content/talent';
import { run, saved, type ActionState } from './shared';



const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(TALENT_STATUSES as [string, ...string[]]),
  staffNotes: z.string().trim().max(4000),
});

export async function updateTalent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('inquiries.manage', async ({ db }) => {
    const parsed = updateSchema.safeParse({
      id: formData.get('id') ?? '',
      status: formData.get('status') ?? 'new',
      staffNotes: formData.get('staffNotes') ?? '',
    });
    if (!parsed.success) return { ok: false, message: 'Could not save that change.' };

    await db.update('talent_submissions', parsed.data.id, {
      status: parsed.data.status,
      staff_notes: parsed.data.staffNotes || null,
    });

    revalidatePath('/admin/talent');
    revalidatePath(`/admin/talent/${parsed.data.id}`);
    return saved('Saved.');
  });
}


export async function addToContractors(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, message: 'Could not find that person.' };

    const talent = await getTalent(db, id);
    if (!talent) return { ok: false, message: 'Could not find that person.' };
    if (talent.contractorId) {
      return { ok: true, message: 'They are already on the contractor roster.' };
    }

    const contractor = await db.insert<{ id: string }>('contractors', {
      name: talent.name,
      phone: talent.phone,
      email: talent.email,
      service_type: serviceTypeFor(talent.discipline as TalentDiscipline),
      // What they said about themselves, plus where to see it, so the roster
      // row is useful on its own rather than a name and a phone number.
      notes: [talent.pitch, ...talent.links].filter(Boolean).join('\n'),
      active: true,
      created_at: new Date().toISOString(),
    });

    await db.update('talent_submissions', id, {
      contractor_id: contractor.id,
      status: talent.status === 'new' || talent.status === 'interested' ? 'contacted' : talent.status,
    });

    revalidatePath('/admin/talent');
    revalidatePath(`/admin/talent/${id}`);
    revalidatePath('/staff/contractors');
    return {
      ok: true,
      message: 'Added to the contractor roster — book them from the staff app.',
    };
  });
}
