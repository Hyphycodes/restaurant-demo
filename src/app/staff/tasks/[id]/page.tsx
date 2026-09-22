import { notFound } from 'next/navigation';
import { Comments } from '@/components/staff/Comments';
import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Facts, Pill, Screen, Section } from '@/components/staff/ui';
import { TASK_STATUS_LABEL } from '@/content/staff-types';
import { formatClock, formatDayLong } from '@/lib/staff/time';
import { changeTaskStatus, removeTask } from '@/server/actions/staff/tasks';
import { listComments } from '@/server/staff/comments';
import { getTask } from '@/server/staff/tasks';
import { canSeeEmployee } from '@/server/staff/session';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('tasks.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const task = await getTask(db, id);
  if (!task) notFound();
  if (!context.isManager && !(task.assignedTo && canSeeEmployee(context, task.assignedTo))) notFound();
  const comments = await listComments(db, 'task', task.id, context.staff.id);
  const timezone = context.location.timezone;
  const next = (['open', 'in_progress', 'blocked', 'done'] as const).filter((status) => status !== task.status);

  return (
    <StaffShell context={context} unread={unread}>
      <Back href={context.isManager && task.assignedTo !== context.employee?.id ? '/staff/operations/tasks' : '/staff'} label={context.isManager && task.assignedTo !== context.employee?.id ? 'Tasks' : 'Home'} />
      <Screen title={task.title} eyebrow={task.overdue ? 'Overdue' : task.priority !== 'normal' ? `${task.priority} priority` : undefined}>
        {task.description ? <p className="whitespace-pre-line text-[1rem] leading-relaxed text-brown">{task.description}</p> : null}
        <Facts
          items={[
            { label: 'Status', value: <Pill tone={task.status === 'done' ? 'good' : task.status === 'blocked' ? 'warn' : task.status === 'in_progress' ? 'accent' : 'neutral'}>{TASK_STATUS_LABEL[task.status]}</Pill> },
            { label: 'Due', value: task.dueAt ? `${formatDayLong(task.dueAt, timezone)}, ${formatClock(task.dueAt, timezone)}` : 'No due time' },
            { label: 'Assigned to', value: task.assignedToName ?? 'Unassigned' },
            { label: 'Event', value: task.eventTitle ?? '—' },
          ]}
        />
        <Section title="Update">
          <div className="flex flex-wrap gap-2">
            {next.map((status) => (
              <OneTap key={status} action={changeTaskStatus} fields={{ id: task.id, status }} variant={status === 'done' ? 'primary' : 'secondary'}>
                {status === 'done' ? 'Mark done' : status === 'in_progress' ? 'Start' : status === 'blocked' ? 'Blocked' : 'Reopen'}
              </OneTap>
            ))}
          </div>
        </Section>
        {context.isManager ? (
          <Section title="Manage">
            <div className="flex flex-wrap items-center gap-2">
              <Button href={`/staff/operations/tasks/${task.id}/edit`}>Edit</Button>
              <OneTap action={removeTask} fields={{ id: task.id }} variant="danger" confirm="Remove this task?">
                Remove
              </OneTap>
            </div>
          </Section>
        ) : null}
        <Comments entityType="task" entityId={task.id} comments={comments} />
      </Screen>
    </StaffShell>
  );
}
