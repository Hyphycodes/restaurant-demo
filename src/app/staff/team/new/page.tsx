import { EmployeeForm } from '@/components/staff/manage/EmployeeForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listEmployees, listPositions } from '@/server/staff/employees';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const page = await staffPage('staff.manage_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const [positions, employees] = await Promise.all([listPositions(db), listEmployees(db)]);
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/team" label="Team" />
      <Screen title="Add an employee" lead="They get an invitation, a welcome email, their onboarding checklist and any required training. Nothing legal is assumed: the checklist is whatever Cosa Nostra put in it.">
        <EmployeeForm employee={null} positions={positions.filter((position) => position.active)} locations={context.locations} managers={employees.filter((employee) => employee.positionIds.includes('manager') || employee.accessRole === 'admin' || employee.accessRole === 'owner')} defaultLocationId={context.location.id} />
      </Screen>
    </StaffShell>
  );
}
