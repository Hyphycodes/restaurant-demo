import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Chips, Empty, Pill, Row, Screen } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { listTasks } from '@/server/staff/tasks';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function AllTasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('tasks.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const tasks = await listTasks(db, { includeDone: true });
  const open = tasks.filter((task) => task.status !== 'done');
  const list = show === 'done' ? tasks.filter((task) => task.status === 'done') : show === 'unassigned' ? open.filter((task) => !task.assignedTo) : show === 'overdue' ? open.filter((task) => task.overdue) : open;
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations" label="Operations" />
      <Screen title="All tasks" actions={<Button href="/staff/operations/tasks/new" variant="primary">New task</Button>}>
        <Chips
          items={[
            { href: '/staff/operations/tasks', label: 'Open', active: !show, count: open.length },
            { href: '/staff/operations/tasks?show=overdue', label: 'Overdue', active: show === 'overdue', count: open.filter((task) => task.overdue).length },
            { href: '/staff/operations/tasks?show=unassigned', label: 'Unassigned', active: show === 'unassigned', count: open.filter((task) => !task.assignedTo).length },
            { href: '/staff/operations/tasks?show=done', label: 'Done', active: show === 'done' },
          ]}
        />
        {list.length === 0 ? <Empty title="Nothing here." /> : (
          <div className="staff-panel px-4">
            {list.map((task) => (
              <Row key={task.id} href={`/staff/tasks/${task.id}`} title={task.title} detail={[task.assignedToName ?? 'Unassigned', task.dueAt ? `due ${formatRelative(task.dueAt)}` : null, task.eventTitle].filter(Boolean).join(' · ')} trailing={task.status === 'done' ? <Pill tone="good">Done</Pill> : task.overdue ? <Pill tone="bad">Overdue</Pill> : task.status === 'blocked' ? <Pill tone="warn">Blocked</Pill> : task.priority === 'urgent' ? <Pill tone="bad">Urgent</Pill> : task.priority === 'high' ? <Pill tone="warn">High</Pill> : null} />
            ))}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
