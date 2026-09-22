import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Chips, Empty, Pill, Row, Screen } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { listTasks } from '@/server/staff/tasks';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/**
 * Your list, in full.
 *
 * Home carries what is left today, which is what a person needs mid-shift.
 * This is the same list with the finished ones kept, for the Tuesday
 * afternoon question of "did I ever do that thing". Not in the navigation
 * on purpose: a tab called Tasks turns an evening's work into admin.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('tasks.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const employee = context.employee;
  const tasks = employee ? await listTasks(db, { assignedTo: employee.id, includeDone: true }, new Date()) : [];
  const open = tasks.filter((task) => task.status !== 'done');
  const done = tasks.filter((task) => task.status === 'done');
  const shown = show === 'done' ? done : open;

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff" label="Home" />
      <Screen
        title="Your list"
        lead="Everything assigned to you, including what you have already finished."
        actions={context.isManager ? <Button href="/staff/operations/tasks" variant="primary">Everyone’s</Button> : undefined}
      >
        <Chips
          items={[
            { href: '/staff/tasks', label: 'To do', active: show !== 'done', count: open.length },
            { href: '/staff/tasks?show=done', label: 'Done', active: show === 'done', count: done.length },
          ]}
        />
        {shown.length === 0 ? (
          <Empty
            title={show === 'done' ? 'Nothing finished yet.' : 'You’re all set.'}
            detail={show === 'done' ? undefined : 'Nothing is waiting on you.'}
            action={<Button href="/staff">Back to today</Button>}
          />
        ) : (
          <div className="staff-panel px-4">
            {shown.map((task) => (
              <Row
                key={task.id}
                href={`/staff/tasks/${task.id}`}
                title={task.title}
                detail={[task.dueAt ? `Due ${formatRelative(task.dueAt)}` : null, task.eventTitle, task.assignedByName ? `from ${task.assignedByName}` : null].filter(Boolean).join(' · ')}
                trailing={
                  task.status === 'done' ? (
                    <Pill tone="good">Done</Pill>
                  ) : task.overdue ? (
                    <Pill tone="bad">Overdue</Pill>
                  ) : task.status === 'blocked' ? (
                    <Pill tone="warn">Blocked</Pill>
                  ) : task.priority === 'urgent' ? (
                    <Pill tone="bad">Urgent</Pill>
                  ) : task.priority === 'high' ? (
                    <Pill tone="warn">High</Pill>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
