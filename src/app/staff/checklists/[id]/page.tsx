import { notFound } from 'next/navigation';
import { Comments } from '@/components/staff/Comments';
import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Pill, Progress, Screen, Section } from '@/components/staff/ui';
import { formatDate } from '@/lib/staff/time';
import { verifyChecklist } from '@/server/actions/staff/checklists';
import { getRun } from '@/server/staff/checklists';
import { listComments } from '@/server/staff/comments';
import { isDenied, staffPage } from '../../_lib';
import { TickItem } from './TickItem';

export const dynamic = 'force-dynamic';

export default async function ChecklistRunPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('checklists.complete');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const run = await getRun(db, id);
  if (!run) notFound();
  if (!context.isManager && run.assignedEmployeeId && run.assignedEmployeeId !== context.employee?.id) notFound();
  const comments = await listComments(db, 'checklist_run', run.id, context.staff.id);
  const locked = run.status === 'verified';

  return (
    <StaffShell context={context} unread={unread}>
      <Back href={context.isManager ? '/staff/operations/checklists' : '/staff'} label={context.isManager ? 'Checklists' : 'Home'} />
      <Screen title={run.title} eyebrow={`${formatDate(run.onDate)}${run.eventTitle ? ` · ${run.eventTitle}` : ''}${run.assignedEmployeeName ? ` · ${run.assignedEmployeeName}` : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Progress value={run.done} max={run.total} />
          </div>
          {run.status === 'verified' ? <Pill tone="good">Verified</Pill> : run.status === 'complete' ? <Pill tone="good">Complete</Pill> : null}
        </div>
        <div className="staff-panel px-4">
          {run.items.map((item) => (
            <TickItem key={item.id} runId={run.id} item={item} locked={locked} />
          ))}
        </div>
        {context.isManager && run.status === 'complete' ? (
          <Section title="Manager">
            <OneTap action={verifyChecklist} fields={{ id: run.id }} variant="secondary">
              Verify this checklist
            </OneTap>
          </Section>
        ) : null}
        <Comments entityType="checklist_run" entityId={run.id} comments={comments} />
      </Screen>
    </StaffShell>
  );
}
