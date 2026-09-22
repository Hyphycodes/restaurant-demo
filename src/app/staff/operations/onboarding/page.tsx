import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Empty, Pill, Progress, Screen, Section } from '@/components/staff/ui';
import { listEmployees } from '@/server/staff/employees';
import { onboardingFor } from '@/server/staff/requirements';
import { listAssignments, outstanding } from '@/server/staff/training';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/** New hires: where each one is, what is missing, who is ready. */
export default async function OnboardingDashboardPage() {
  const page = await staffPage('staff.manage_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const employees = (await listEmployees(db)).filter((employee) => !employee.onboardingCompletedAt);
  const rows = await Promise.all(
    employees.map(async (employee) => {
      const [progress, training] = await Promise.all([onboardingFor(db, employee.id), listAssignments(db, { employeeId: employee.id })]);
      return { employee, progress, trainingTodo: outstanding(training) };
    }),
  );
  const groups = {
    not_started: rows.filter((row) => row.progress.stage === 'not_started'),
    in_progress: rows.filter((row) => row.progress.stage === 'in_progress'),
    ready: rows.filter((row) => row.progress.stage === 'ready'),
  };
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/team" label="Team" />
      <Screen title="Onboarding" lead={`${rows.length} ${rows.length === 1 ? 'new hire' : 'new hires'} in progress.`} actions={<Button href="/staff/team/new" variant="primary">Add employee</Button>}>
        {rows.length === 0 ? <Empty title="No new hires right now." detail="Add someone and their checklist starts here." /> : null}
        {(['ready', 'in_progress', 'not_started'] as const).map((stage) =>
          groups[stage].length > 0 ? (
            <Section key={stage} title={stage === 'ready' ? 'Ready for first shift' : stage === 'in_progress' ? 'In progress' : 'Not started'} count={groups[stage].length}>
              <div className="grid gap-2 lg:grid-cols-2">
                {groups[stage].map(({ employee, progress, trainingTodo }) => {
                  const missing = progress.items.filter((item) => item.state === 'missing' && item.type.kind !== 'system');
                  const waiting = progress.items.filter((item) => item.state === 'submitted');
                  const overdue = trainingTodo.filter((assignment) => assignment.overdue);
                  return (
                    <a key={employee.id} href={`/staff/team/${employee.id}?tab=onboarding`} className="staff-panel block px-4 py-3.5 active:bg-brown/6">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[1rem] font-semibold text-brown">{employee.fullName || employee.displayName}</p>
                        <span className="flex gap-1">
                          {waiting.length ? <Pill tone="accent">{waiting.length} to verify</Pill> : null}
                          {overdue.length ? <Pill tone="bad">training overdue</Pill> : null}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
                        {employee.positionIds.join(', ') || 'No position'} · starts {employee.startDate ?? 'TBD'}
                      </p>
                      <div className="mt-2">
                        <Progress value={progress.complete} max={progress.total} />
                      </div>
                      {missing.length > 0 ? <p className="mt-2 text-[0.8125rem] text-brown-soft">Missing: {missing.map((item) => item.type.title).join(', ')}</p> : null}
                      {trainingTodo.length > 0 ? <p className="mt-1 text-[0.8125rem] text-brown-soft">Training: {trainingTodo.map((assignment) => assignment.module.title).join(', ')}</p> : null}
                    </a>
                  );
                })}
              </div>
            </Section>
          ) : null,
        )}
      </Screen>
    </StaffShell>
  );
}
