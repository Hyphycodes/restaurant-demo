import { redirect } from 'next/navigation';
import { getStaff } from '@/server/auth';
import { createDraftEvent } from '@/server/actions/event-editor';

export const dynamic = 'force-dynamic';

/**
 * New event: make a draft and open it. The editor is one page, so the only
 * thing "new" has to do is give it a row to autosave into.
 */
export default async function NewEventPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const created = await createDraftEvent();
  if (!created.ok || !created.id) redirect(`/admin/events?error=${encodeURIComponent(created.message ?? 'Could not start a new event.')}`);
  redirect(`/admin/events/one/${encodeURIComponent(created.id)}`);
}
