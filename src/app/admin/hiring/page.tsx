import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { SearchField } from '@/components/admin/SearchField';
import { Card, EmptyState, LinkButton, Tabs } from '@/components/admin/ui';
import { APPLICATION_STATUS_LABEL } from '@/content/careers';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableOpenings, listApplications } from '@/server/content/hiring';
import { ApplicantRow } from './ApplicantRow';

export const dynamic = 'force-dynamic';

/**
 * Applicants.
 *
 * The default view is everyone still in play — hired, passed and archived are
 * filed, not read — and each row opens in place rather than on its own route,
 * because working through a morning's applications means opening six of them
 * and none of that is worth six page loads.
 */
export default async function HiringPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; role?: string; q?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'inquiries.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Applicants">
        <NoAccess what="job applications" />
      </AdminShell>
    );
  }

  const params = await searchParams;
  const status = params.status ?? 'open';
  const db = getReadDb();

  const [applications, openings] = await Promise.all([
    db ? listApplications(db, { status, openingId: params.role, query: params.q }) : [],
    db ? getEditableOpenings(db) : [],
  ]);
  const all = db ? await listApplications(db) : [];

  const count = (value: string) =>
    value === 'open'
      ? all.filter((entry) => !['hired', 'passed', 'archived'].includes(entry.status)).length
      : all.filter((entry) => entry.status === value).length;

  const keep = { role: params.role, status: params.status };
  const tabs = [
    { id: 'open', label: 'Open' },
    { id: 'new', label: APPLICATION_STATUS_LABEL.new },
    { id: 'reviewing', label: APPLICATION_STATUS_LABEL.reviewing },
    { id: 'interview', label: APPLICATION_STATUS_LABEL.interview },
    { id: 'hired', label: APPLICATION_STATUS_LABEL.hired },
    { id: 'archived', label: APPLICATION_STATUS_LABEL.archived },
  ];

  const liveOpenings = openings.filter((opening) => opening.active && !opening.archivedAt);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Applicants"
      description="Everyone who has asked to work at Cosa Nostra, newest first."
      actions={<LinkButton href="/admin/hiring/openings">Job openings</LinkButton>}
    >
      {!db ? (
        <EmptyState>
          Applications are not connected yet, so the form on the website asks people to call
          instead of claiming their application was saved.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <Card>
            <Tabs
              label="Filter applicants"
              items={tabs.map((tab) => ({
                href: query('/admin/hiring', { status: tab.id, role: params.role, q: params.q }),
                label: tab.label,
                active: status === tab.id,
                count: count(tab.id),
              }))}
            />
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <SearchField
                id="applicant-search"
                name="q"
                label="Find someone"
                placeholder="Name, email, phone or role"
                initial={params.q ?? ''}
                basePath="/admin/hiring"
                keep={keep}
              />
              {liveOpenings.length > 0 ? (
                <div className="min-w-48">
                  <p className="text-[0.8125rem] font-semibold text-brown">Role</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <RoleChip
                      href={query('/admin/hiring', { status: params.status, q: params.q })}
                      label="All"
                      active={!params.role}
                    />
                    {liveOpenings.map((opening) => (
                      <RoleChip
                        key={opening.id}
                        href={query('/admin/hiring', {
                          status: params.status,
                          q: params.q,
                          role: opening.id,
                        })}
                        label={opening.title}
                        active={params.role === opening.id}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {applications.length === 0 ? (
            <EmptyState>
              {all.length === 0
                ? 'Nobody has applied yet. Switch a role on in Job openings and it appears on the website.'
                : 'Nobody here matches that.'}
            </EmptyState>
          ) : (
            <Card tone="quiet">
              <ul>
                {applications.map((application) => (
                  <ApplicantRow key={application.id} application={application} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function query(base: string, values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

function RoleChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-9 items-center rounded-full px-3 text-[0.8125rem] font-semibold transition-colors ${
        active ? 'bg-brown text-linen' : 'border border-brown/25 text-brown-soft hover:text-brown'
      }`}
    >
      {label}
    </a>
  );
}
