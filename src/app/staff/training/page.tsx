import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Chips, Empty, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { TRAINING_CATEGORY_ORDER, trainingCategoryLabel } from '@/content/staff-types';
import { formatDate } from '@/lib/staff/time';
import { listAssignments, listModules, outstanding } from '@/server/staff/training';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/** The academy, for one person: what is required, what is done, what else is there. */
export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('training.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const employee = context.employee;
  const [assignments, modules] = await Promise.all([employee ? listAssignments(db, { employeeId: employee.id }) : Promise.resolve([]), listModules(db)]);
  const todo = outstanding(assignments);
  const done = assignments.filter((assignment) => !todo.includes(assignment));
  const assignedIds = new Set(assignments.map((assignment) => assignment.moduleId));
  const library = modules.filter((module) => !assignedIds.has(module.id));
  const list = show === 'done' ? done : show === 'library' ? [] : todo;

  return (
    <StaffShell context={context} unread={unread}>
      <Screen title="Training" actions={context.isManager ? <Button href="/staff/operations/training">Manage training</Button> : undefined}>
        <Chips
          items={[
            { href: '/staff/training', label: 'To do', active: !show, count: todo.length },
            { href: '/staff/training?show=done', label: 'Completed', active: show === 'done', count: done.length },
            { href: '/staff/training?show=library', label: 'Library', active: show === 'library', count: library.length },
          ]}
        />
        {show === 'library' ? (
          library.length === 0 ? (
            <Section title="Everything else">
              <Empty title="Nothing else to read." detail="Every published module is already on your list." />
            </Section>
          ) : (
            [...TRAINING_CATEGORY_ORDER, ...Array.from(new Set(library.map((module) => module.category))).filter((category) => !(TRAINING_CATEGORY_ORDER as readonly string[]).includes(category))].map((category) => {
              const inCategory = library.filter((module) => module.category === category);
              if (inCategory.length === 0) return null;
              return (
                <Section key={category} title={trainingCategoryLabel(category)} count={inCategory.length}>
                  <div className="staff-panel px-4">
                    {inCategory.map((module) => (
                      <Row key={module.id} href={`/staff/training/${module.id}`} title={module.title} detail={module.description ?? undefined} meta={module.estimatedMinutes ? `About ${module.estimatedMinutes} min${module.hasQuiz ? ' · quiz' : ''}` : module.hasQuiz ? 'Quiz' : undefined} />
                    ))}
                  </div>
                </Section>
              );
            })
          )
        ) : list.length === 0 ? (
          <Empty title={show === 'done' ? 'Nothing completed yet.' : 'You’re all caught up.'} detail={show === 'done' ? 'Finish something and it shows up here.' : 'Nothing to do right now. The library has everything else.'} />
        ) : (
          <Section title={show === 'done' ? 'Completed' : 'To do'}>
            <div className="staff-panel px-4">
              {list.map((assignment) => (
                <Row
                  key={assignment.id}
                  href={`/staff/training/${assignment.moduleId}`}
                  title={assignment.module.title}
                  detail={assignment.module.description ?? undefined}
                  meta={
                    show === 'done'
                      ? `Completed ${assignment.completedAt ? formatDate(assignment.completedAt.slice(0, 10), 'short') : ''}${assignment.score !== null ? ` · ${assignment.score}%` : ''}${assignment.expiresAt ? ` · renews ${formatDate(assignment.expiresAt.slice(0, 10), 'short')}` : ''}`
                      : [assignment.dueOn ? `Due ${formatDate(assignment.dueOn, 'short')}` : null, assignment.module.estimatedMinutes ? `About ${assignment.module.estimatedMinutes} min` : null, assignment.module.hasQuiz ? 'Ends with a quiz' : null].filter(Boolean).join(' · ')
                  }
                  trailing={
                    show === 'done' ? <Pill tone="good">Done</Pill> : assignment.overdue ? <Pill tone="bad">Overdue</Pill> : assignment.status === 'expired' ? <Pill tone="warn">Renew</Pill> : assignment.outdated ? <Pill tone="warn">New version</Pill> : assignment.status === 'in_progress' ? <Pill tone="accent">Started</Pill> : assignment.module.required ? <Pill tone="accent">Required</Pill> : null
                  }
                />
              ))}
            </div>
          </Section>
        )}
      </Screen>
    </StaffShell>
  );
}
