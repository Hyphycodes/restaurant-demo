import { TaskForm } from '@/components/staff/manage/TaskForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listEmployees } from '@/server/staff/employees';
import { eventOptionsFor, isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ event?: string; employee?: string }> }) {
  const page = await staffPage('tasks.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const params = await searchParams;
  const [employees, events] = await Promise.all([listEmployees(db), eventOptionsFor(db, context.location.timezone)]);
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/operations/tasks" label="Tasks" />
      <Screen title="New task">
        <TaskForm task={null} employees={employees} locations={context.locations} events={events} defaultLocationId={context.location.id} defaultEventId={params.event ?? null} defaultEmployeeId={params.employee ?? null} />
      </Screen>
    </StaffShell>
  );
}
