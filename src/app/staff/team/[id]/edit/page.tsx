import { notFound } from 'next/navigation';
import { EmployeeForm } from '@/components/staff/manage/EmployeeForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { getEmployee, listEmployees, listPositions } from '@/server/staff/employees';
import { isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('staff.manage_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const employee = await getEmployee(db, id);
  if (!employee) notFound();
  const [positions, employees] = await Promise.all([listPositions(db), listEmployees(db)]);
  return (
    <StaffShell context={context} unread={unread}>
      <Back href={`/staff/team/${employee.id}`} label={employee.displayName} />
      <Screen title={`Edit ${employee.displayName}`}>
        <EmployeeForm employee={employee} positions={positions.filter((position) => position.active)} locations={context.locations} managers={employees.filter((entry) => entry.id !== employee.id && (entry.positionIds.includes('manager') || entry.accessRole === 'admin' || entry.accessRole === 'owner'))} defaultLocationId={context.location.id} />
      </Screen>
    </StaffShell>
  );
}
