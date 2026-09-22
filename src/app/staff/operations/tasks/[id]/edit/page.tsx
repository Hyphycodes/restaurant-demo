import { notFound } from 'next/navigation';
import { TaskForm } from '@/components/staff/manage/TaskForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listEmployees } from '@/server/staff/employees';
import { getTask } from '@/server/staff/tasks';
import { eventOptionsFor, isDenied, staffPage } from '../../../../_lib';

export const dynamic = 'force-dynamic';

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('tasks.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const [task, employees, events] = await Promise.all([getTask(db, id), listEmployees(db), eventOptionsFor(db, context.location.timezone)]);
  if (!task) notFound();
  return (
    <StaffShell context={context} unread={unread}>
      <Back href={`/staff/tasks/${task.id}`} label={task.title} />
      <Screen title="Edit task">
        <TaskForm task={task} employees={employees} locations={context.locations} events={events} defaultLocationId={context.location.id} />
      </Screen>
    </StaffShell>
  );
}
