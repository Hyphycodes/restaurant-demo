import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { LinkButton } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { getAttention } from '@/server/content/attention';
import { TidyFix } from './TidyFix';

export const dynamic = 'force-dynamic';

/**
 * Housekeeping, as a list with one tap per item.
 *
 * Nothing here is urgent and nothing here is broken — a past event still
 * listed is hidden from guests on its own. It is the place the home screen's
 * one sentence points to, and it is written to be emptied without hurry.
 */
export default async function TidyPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const db = getReadDb();
  const items = db ? (await getAttention(db, new Date())).filter((entry) => entry.kind !== 'tickets') : [];

  return (
    <AdminShell
      staff={staff}
      local={isLocalDb()}
      title="Tidy up"
      description="Small things, none of them urgent. Guests are not seeing any of it."
      backTo={{ href: '/admin', label: 'Home' }}
    >
      {items.length === 0 ? (
        <p className="text-[0.9375rem] text-brown-soft">Nothing to tidy.</p>
      ) : (
        <ul className="divide-y divide-brown/10">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <p className="min-w-0 flex-1 basis-72 text-[0.9375rem] leading-relaxed text-brown">{entry.message}</p>
              {entry.fix ? (
                <TidyFix fix={entry.fix} label={entry.actionLabel} />
              ) : (
                <LinkButton href={entry.href} variant="secondary">{entry.actionLabel}</LinkButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
