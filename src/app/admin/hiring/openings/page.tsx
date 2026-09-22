import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, HelpNote, LinkButton, SummaryStrip } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableOpenings, listApplications } from '@/server/content/hiring';
import { NewOpening, OpeningEditor } from './OpeningEditor';

export const dynamic = 'force-dynamic';


export default async function OpeningsPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'content.edit')) {
    return (
      <AdminShell staff={staff} local={local} title="Job openings" backTo={{ href: '/admin/hiring', label: 'Applicants' }}>
        <NoAccess what="job openings" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  const [openings, applications] = await Promise.all([
    db ? getEditableOpenings(db) : [],
    db ? listApplications(db) : [],
  ]);

  const live = openings.filter((opening) => opening.active && !opening.archivedAt);
  const off = openings.filter((opening) => !opening.active && !opening.archivedAt);
  const archived = openings.filter((opening) => opening.archivedAt);
  const countFor = (id: string) => applications.filter((entry) => entry.openingId === id).length;

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Job openings"
      description="Only the roles switched on here appear on the website."
      backTo={{ href: '/admin/hiring', label: 'Applicants' }}
      actions={<LinkButton href="/careers" external>View the careers page</LinkButton>}
    >
      {!db ? (
        <EmptyState>Openings are not connected yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <SummaryStrip tone={live.length === 0 ? 'warning' : 'info'}>
            {live.length === 0 ? (
              <>
                <strong className="font-semibold">Nothing is posted.</strong> The careers page says
                so honestly and still takes open applications. Switch a role on to advertise it.
              </>
            ) : (
              <>
                <strong className="font-semibold">
                  {live.length === 1 ? 'One role is' : `${live.length} roles are`} on the website
                </strong>{' '}
                right now.
              </>
            )}
          </SummaryStrip>

          <Card title="On the website">
            {live.length === 0 ? (
              <p className="text-[0.9375rem] text-brown-soft">Nothing switched on yet.</p>
            ) : (
              <ul className="divide-y divide-brown/10">
                {live.map((opening) => (
                  <OpeningEditor
                    key={opening.id}
                    opening={opening}
                    applicants={countFor(opening.id)}
                    canArchive={staffCan(staff, 'content.archive')}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Switched off" tone="quiet">
            <HelpNote>
              These are ready to go. Edit the sentence under a title if you want one, then switch
              it on — nothing here is visible to anybody outside Cosa Nostra.
            </HelpNote>
            {off.length === 0 ? (
              <p className="mt-4 text-[0.9375rem] text-brown-soft">Nothing waiting.</p>
            ) : (
              <ul className="mt-4 divide-y divide-brown/10">
                {off.map((opening) => (
                  <OpeningEditor
                    key={opening.id}
                    opening={opening}
                    applicants={countFor(opening.id)}
                    canArchive={staffCan(staff, 'content.archive')}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Add a role" tone="quiet">
            <NewOpening />
          </Card>

          {archived.length > 0 ? (
            <Card title="Archived" tone="quiet">
              <ul className="divide-y divide-brown/10">
                {archived.map((opening) => (
                  <OpeningEditor
                    key={opening.id}
                    opening={opening}
                    applicants={countFor(opening.id)}
                    canArchive={staffCan(staff, 'content.archive')}
                  />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
