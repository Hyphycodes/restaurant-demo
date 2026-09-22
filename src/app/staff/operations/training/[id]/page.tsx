import { notFound } from 'next/navigation';
import { OneTap } from '@/components/staff/forms';
import { AssignTrainingForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Facts, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { markTrainingComplete } from '@/server/actions/staff/training';
import { listEmployees } from '@/server/staff/employees';
import { getModule, whoIsCleared } from '@/server/staff/training';
import { isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

/** One module: who is cleared, who is not, assign more. Answers "who can work the door". */
export default async function ManageModulePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('training.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const lesson = await getModule(db, id);
  if (!lesson) notFound();
  const [{ cleared, outstanding }, employees] = await Promise.all([whoIsCleared(db, id), listEmployees(db)]);
  const assigned = new Set([...cleared, ...outstanding].map((assignment) => assignment.employeeId));
  const applicable = employees.filter((employee) => lesson.appliesToPositions.length === 0 || lesson.appliesToPositions.some((position) => employee.positionIds.includes(position)));
  const never = applicable.filter((employee) => !assigned.has(employee.id));
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations/training" label="Training" />
      <Screen
        title={lesson.title}
        eyebrow={`v${lesson.version} · ${lesson.status}`}
        lead={lesson.description}
        actions={
          <div className="flex gap-2">
            <Button href={`/staff/training/${lesson.id}`}>Preview</Button>
            <Button href={`/staff/operations/training/${lesson.id}/edit`} variant="primary">
              Edit
            </Button>
          </div>
        }
      >
        <Facts
          items={[
            { label: 'Required', value: lesson.required ? 'Yes, for new hires in its positions' : 'No' },
            { label: 'Applies to', value: lesson.appliesToPositions.length ? lesson.appliesToPositions.join(', ') : 'Everyone' },
            { label: 'Quiz', value: lesson.questions.length ? `${lesson.questions.length} questions · pass ${lesson.passingScore}%` : 'None' },
            { label: 'Retrain', value: lesson.retrainIntervalDays ? `Every ${lesson.retrainIntervalDays} days` : 'Never expires' },
          ]}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Cleared" count={cleared.length}>
            {cleared.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nobody yet.</p> : (
              <div className="staff-panel px-4">
                {cleared.map((assignment) => (
                  <Row key={assignment.id} href={`/staff/team/${assignment.employeeId}?tab=training`} title={assignment.employeeName} detail={`Completed ${assignment.completedAt?.slice(0, 10)}${assignment.score !== null ? ` · ${assignment.score}%` : ''}${assignment.expiresAt ? ` · renews ${assignment.expiresAt.slice(0, 10)}` : ''}`} trailing={<Pill tone="good">Cleared</Pill>} />
                ))}
              </div>
            )}
          </Section>
          <Section title="Still needs it" count={outstanding.length + never.length}>
            {outstanding.length + never.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Everyone it applies to is cleared.</p> : (
              <div className="staff-panel px-4">
                {outstanding.map((assignment) => (
                  <div key={assignment.id} className="staff-row">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-brown">{assignment.employeeName}</span>
                      <span className="block text-[0.8125rem] text-brown-soft">{assignment.outdated ? `Completed v${assignment.completedVersion}, needs v${lesson.version}` : assignment.dueOn ? `Due ${assignment.dueOn}` : assignment.status.replace('_', ' ')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {assignment.overdue ? <Pill tone="bad">Overdue</Pill> : assignment.outdated ? <Pill tone="warn">Outdated</Pill> : <Pill tone="accent">{assignment.status.replace('_', ' ')}</Pill>}
                      <OneTap action={markTrainingComplete} fields={{ assignmentId: assignment.id }} variant="quiet" quiet confirm="Mark complete on their behalf?">
                        Mark complete
                      </OneTap>
                    </span>
                  </div>
                ))}
                {never.map((employee) => (
                  <Row key={employee.id} href={`/staff/team/${employee.id}?tab=training`} title={employee.displayName} detail="Not assigned" trailing={<Pill>Unassigned</Pill>} />
                ))}
              </div>
            )}
          </Section>
        </div>
        <Section title="Assign">
          <div className="staff-panel px-4 py-3">
            <AssignTrainingForm moduleId={lesson.id} employees={employees.filter((employee) => !assigned.has(employee.id))} />
          </div>
        </Section>
      </Screen>
    </StaffShell>
  );
}
