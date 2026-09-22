import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, LinkButton, Notice } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getStaff, LOCAL_STAFF, staffCan } from '@/server/auth';
import { ADMIN_ROLES, ROLE_LABEL, ROLE_SUMMARY, SECTIONS, type Role } from '@/server/permissions';
import { AddTeamMember } from './AddTeamMember';
import { TeamMemberForm } from './TeamMemberForm';

export const dynamic = 'force-dynamic';

/**
 * Team & permissions. Owner only.
 *
 * Roles are Owner-only in the database as well as here. Under the original policy
 * a Manager could change roles — including their own — which is the classic way an
 * account quietly becomes an Owner. Migration 0003 closes it.
 */
export default async function TeamPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!staffCan(staff, 'team.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Team & permissions">
        <NoAccess what="staff accounts" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  const profiles = db && !local ? await db.list<Row>('profiles', { orderBy: 'role' }) : [];

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Team & permissions"
      description="Who can change what. Only you can change these."
    >
      <div className="grid gap-5">
        {!local ? <Card title="Add a staff member"><AddTeamMember /></Card> : null}
        <Card title="What each role can do">
          <dl className="grid gap-3">
            {ADMIN_ROLES.map((role) => (
              <div key={role} className="border-b border-brown/12 pb-3 last:border-b-0">
                <dt className="text-[0.9375rem] font-semibold text-brown">{ROLE_LABEL[role]}</dt>
                <dd className="mt-0.5 text-[0.875rem] text-brown-soft">{ROLE_SUMMARY[role]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-brown-soft">
            A Contributor’s work is never lost — it is saved as a draft and a manager publishes it.
            Restrictions are checked by the database, not just hidden in this screen.
          </p>
        </Card>

        {local ? (
          <Card title="Accounts">
            <Notice tone="warning">
              This is the local development copy, so these three accounts exist only to try each
              role. Real accounts are created in Supabase.
            </Notice>
            <ul className="mt-4 grid gap-2">
              {(Object.keys(LOCAL_STAFF) as Role[]).filter((role) => role !== 'contractor').map((role) => (
                <li key={role} className="flex flex-wrap items-baseline gap-x-3 border-b border-brown/12 pb-2">
                  <span className="text-[0.9375rem] font-medium text-brown">
                    {LOCAL_STAFF[role].name}
                  </span>
                  <span className="text-[0.8125rem] text-brown-soft">{LOCAL_STAFF[role].email}</span>
                  <span className="ml-auto text-[0.8125rem] font-semibold text-clay">
                    {ROLE_LABEL[role]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card title="Accounts">
            {profiles.length === 0 ? (
              <EmptyState>
                No staff accounts yet. Add someone using the form above.
              </EmptyState>
            ) : (
              <ul className="grid gap-4">
                {profiles.map((row) => (
                  <li key={String(row.user_id)}>
                    <TeamMemberForm
                      member={{
                        userId: String(row.user_id),
                        name: String(row.name ?? ''),
                        role: (row.role as Role) ?? 'editor',
                        active: row.active !== false,
                        sections: (row.sections as string[]) ?? [],
                      }}
                      sections={[...SECTIONS]}
                      isSelf={String(row.user_id) === staff.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Employees" tone="quiet">
          <p className="measure text-[0.9375rem] leading-relaxed text-brown-soft">
            Bartenders, servers, door and event staff are added in the staff app, not here. An employee
            account signs in to <code className="text-brown">/staff</code> and never sees this admin.
          </p>
          <div className="mt-4">
            <LinkButton href="/staff/team">Open the team directory</LinkButton>
          </div>
        </Card>

        <Card title="Connected services" tone="quiet">
          <p className="measure text-[0.9375rem] leading-relaxed text-brown-soft">
            Ordering and table booking run on Demo ordering, tickets on your ticketing site, and the website
            links to them. Credentials for those are held by your developer and are never shown in
            this admin — including to you.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
