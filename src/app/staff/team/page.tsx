import { SearchField } from '@/components/admin/SearchField';
import { StaffShell } from '@/components/staff/StaffShell';
import { Avatar, Button, Chips, Empty, Pill, Screen } from '@/components/staff/ui';
import { EMPLOYEE_STATUS_LABEL } from '@/content/staff-types';
import { formatDayShort, formatShiftRange } from '@/lib/staff/time';
import { listEmployees, listPositions } from '@/server/staff/employees';
import { requirementOverview } from '@/server/staff/requirements';
import { listShifts } from '@/server/staff/schedule';
import { listAssignments, outstanding } from '@/server/staff/training';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/** The directory: who works here, what they do, when they are next in, and what is missing. */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string; position?: string; status?: string }> }) {
  const page = await staffPage('staff.view_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const params = await searchParams;
  const [employees, positions, training] = await Promise.all([
    listEmployees(db, { query: params.q, positionId: params.position, includeInactive: params.status === 'inactive' }),
    listPositions(db),
    listAssignments(db),
  ]);
  const shown = params.status === 'inactive' ? employees.filter((employee) => employee.status === 'inactive') : employees;
  const now = new Date();
  // Drafts are included here on purpose: a manager asking "is Carlos on next
  // week" wants the answer they are building, not the answer staff can see.
  // The card says which it is.
  const upcoming = await listShifts(db, { from: now.toISOString(), to: new Date(now.getTime() + 14 * 86_400_000).toISOString(), includeDrafts: true });
  const overview = await requirementOverview(db, shown.map((employee) => employee.id));
  const positionName = (id: string) => positions.find((position) => position.id === id)?.name ?? id;

  return (
    <StaffShell context={context} unread={unread} wide>
      <Screen title="Team" lead={`${shown.length} ${shown.length === 1 ? 'person' : 'people'}`} actions={<Button href="/staff/team/new" variant="primary">Add employee</Button>}>
        <div className="flex flex-wrap items-end gap-3">
          <SearchField id="team-search" name="q" label="Search" placeholder="Name, phone, email, position" initial={params.q ?? ''} basePath="/staff/team" keep={{ position: params.position, status: params.status }} />
        </div>
        <Chips
          items={[
            { href: `/staff/team${params.q ? `?q=${params.q}` : ''}`, label: 'Everyone', active: !params.position && params.status !== 'inactive' },
            ...positions.filter((position) => position.active).map((position) => ({ href: `/staff/team?position=${position.id}${params.q ? `&q=${params.q}` : ''}`, label: position.name, active: params.position === position.id })),
            { href: '/staff/team?status=inactive', label: 'Inactive', active: params.status === 'inactive' },
            { href: '/staff/operations/onboarding', label: 'Onboarding', active: false },
          ]}
        />
        {shown.length === 0 ? (
          <Empty title="Nobody matches." detail={params.q ? 'Try part of a name, or a position.' : 'Add the first person and the rest of the app fills in around them.'} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((employee) => {
              const next = upcoming.filter((shift) => shift.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
              const todo = outstanding(training.filter((assignment) => assignment.employeeId === employee.id)).length;
              const docs = overview.get(employee.id);
              const docIssues = (docs?.missing.length ?? 0) + (docs?.expired.length ?? 0);
              return (
                <a key={employee.id} href={`/staff/team/${employee.id}`} className="staff-panel flex gap-3 px-4 py-3.5 active:bg-brown/6">
                  <Avatar name={employee.fullName || employee.displayName} url={employee.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.9375rem] font-semibold text-brown">{employee.fullName || employee.displayName}</span>
                      {employee.status !== 'active' ? <Pill tone={employee.status === 'invited' ? 'accent' : 'neutral'}>{EMPLOYEE_STATUS_LABEL[employee.status]}</Pill> : null}
                    </span>
                    <span className="block truncate text-[0.8125rem] text-brown-soft">{employee.positionIds.map(positionName).join(', ') || 'No position yet'}</span>
                    <span className="block truncate text-[0.8125rem] text-brown-soft">{employee.phone ?? employee.email}</span>
                    <span className="mt-1 block text-[0.8125rem] text-brown">
                      {next
                        ? `Next: ${formatDayShort(next.startsAt, context.location.timezone)} ${formatShiftRange(next.startsAt, next.endsAt, context.location.timezone)}${next.status === 'draft' ? ' · draft' : ''}`
                        : 'Not scheduled'}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {todo ? <Pill tone="accent">{todo} training</Pill> : null}
                      {docIssues ? <Pill tone="warn">{docIssues} docs</Pill> : null}
                      {docs?.expiring.length ? <Pill tone="warn">expiring</Pill> : null}
                      {!employee.onboardingCompletedAt && employee.status !== 'inactive' ? <Pill>onboarding</Pill> : null}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
