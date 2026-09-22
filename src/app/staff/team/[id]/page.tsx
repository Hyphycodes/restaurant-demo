import { notFound } from 'next/navigation';
import { OneTap } from '@/components/staff/forms';
import { AccessForm, AssignTrainingForm, NoteForm, VerifyForm } from '@/components/staff/manage/MoreForms';
import { RequirementCard } from '@/components/staff/RequirementCard';
import { ShiftRow } from '@/components/staff/ShiftCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Avatar, Back, Button, Chips, Empty, Facts, Pill, Progress, Row, Screen, Section } from '@/components/staff/ui';
import { EMPLOYEE_STATUS_LABEL, EMPLOYMENT_TYPE_LABEL } from '@/content/staff-types';
import { WEEKDAY_SHORT, formatDate, formatDateRange, formatRelative, zonedDate } from '@/lib/staff/time';
import { removeManagerNote } from '@/server/actions/staff/notes';
import { completeOnboarding } from '@/server/actions/staff/requirements';
import { sendInvitation } from '@/server/actions/staff/team';
import { markTrainingComplete } from '@/server/actions/staff/training';
import { recentOpsAudit } from '@/server/staff/audit';
import { describeRule, listAvailabilityFor } from '@/server/staff/availability';
import { getEmployee, listPositions } from '@/server/staff/employees';
import { listNotes } from '@/server/staff/notes';
import { listRequirementsFor, onboardingFor } from '@/server/staff/requirements';
import { listShiftViews } from '@/server/staff/schedule';
import { contextCan } from '@/server/staff/session';
import { listTimeOff } from '@/server/staff/timeoff';
import { listAssignments, listModules } from '@/server/staff/training';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'schedule' | 'availability' | 'training' | 'documents' | 'onboarding' | 'activity' | 'notes';

/** One person, every section a manager needs, with the sensitive ones gated by capability. */
export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const page = await staffPage('staff.view_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const employee = await getEmployee(db, id, { withPhoto: true });
  if (!employee) notFound();
  const tab = (['overview', 'schedule', 'availability', 'training', 'documents', 'onboarding', 'activity', 'notes'].includes(tabParam ?? '') ? tabParam : 'overview') as Tab;
  const positions = await listPositions(db);
  const positionName = (positionId: string) => positions.find((position) => position.id === positionId)?.name ?? positionId;
  const now = new Date();
  const today = zonedDate(now, context.location.timezone);
  const canNotes = contextCan(context, 'notes.manage');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'availability', label: 'Availability' },
    { id: 'training', label: 'Training' },
    { id: 'documents', label: 'Documents' },
    ...(employee.onboardingCompletedAt ? [] : [{ id: 'onboarding' as Tab, label: 'Onboarding' }]),
    { id: 'activity', label: 'Activity' },
    ...(canNotes ? [{ id: 'notes' as Tab, label: 'Manager notes' }] : []),
  ];

  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/team" label="Team" />
      <Screen
        title={employee.fullName || employee.displayName}
        eyebrow={employee.positionIds.map(positionName).join(' · ') || 'No position yet'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`/staff/team/${employee.id}/edit`}>Edit</Button>
            <Button href={`/staff/schedule?add=${today}&who=${employee.id}`} variant="primary">
              Add shift
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-4">
          <Avatar name={employee.fullName || employee.displayName} url={employee.photoUrl} size="lg" />
          <div className="text-[0.9375rem] text-brown-soft">
            <p className="flex items-center gap-2 text-brown">
              <Pill tone={employee.status === 'active' ? 'good' : employee.status === 'inactive' ? 'neutral' : 'accent'}>{EMPLOYEE_STATUS_LABEL[employee.status]}</Pill>
              {employee.userId ? <Pill>{employee.accessRole === 'owner' ? 'Owner' : employee.accessRole === 'admin' ? 'Manager' : 'Has sign-in'}</Pill> : <Pill tone="warn">No sign-in</Pill>}
            </p>
            <p className="mt-1">{employee.phone ?? 'No phone'} · {employee.email}</p>
          </div>
        </div>
        <Chips items={tabs.map((entry) => ({ href: `/staff/team/${employee.id}?tab=${entry.id}`, label: entry.label, active: tab === entry.id }))} />

        {tab === 'overview' ? (
          <>
            <Facts
              items={[
                { label: 'Employment', value: EMPLOYMENT_TYPE_LABEL[employee.employmentType] },
                { label: 'Location', value: context.locations.find((location) => location.id === employee.primaryLocationId)?.name ?? '—' },
                { label: 'Hired', value: employee.hireDate ?? '—' },
                { label: 'First day', value: employee.startDate ?? '—' },
                { label: 'Reports to', value: employee.managerEmployeeId ? (await getEmployee(db, employee.managerEmployeeId))?.displayName ?? '—' : '—' },
                { label: 'Preferred language', value: employee.preferredLanguage === 'es' ? 'Español' : 'English' },
                { label: 'Emergency contact', value: employee.emergencyContactName ? `${employee.emergencyContactName}${employee.emergencyContactRelationship ? ` (${employee.emergencyContactRelationship})` : ''} · ${employee.emergencyContactPhone ?? ''}` : 'Not set' },
                { label: 'Shirt size', value: employee.shirtSize ?? 'Not set' },
              ]}
            />
            {!employee.userId ? (
              <Section title="Sign-in">
                <div className="staff-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <p className="text-[0.9375rem] text-brown">No sign-in yet. Send the invitation and they can open the staff app.</p>
                  <OneTap action={sendInvitation} fields={{ employeeId: employee.id }} variant="secondary">
                    Send invitation
                  </OneTap>
                </div>
              </Section>
            ) : contextCan(context, 'staff.manage_access') && employee.userId !== context.staff.id ? (
              <Section title="Account access">
                <div className="staff-panel px-4 py-3">
                  <AccessForm employeeId={employee.id} current={employee.accessRole} />
                  <p className="mt-2 text-[0.8125rem] text-brown-soft">Only the owner can change this. The database refuses it from anyone else.</p>
                </div>
              </Section>
            ) : null}
          </>
        ) : null}

        {tab === 'schedule' ? <ScheduleTab employeeId={employee.id} db={db} now={now} /> : null}

        {tab === 'availability' ? <AvailabilityTab employeeId={employee.id} db={db} /> : null}

        {tab === 'training' ? <TrainingTab employeeId={employee.id} db={db} /> : null}

        {tab === 'documents' ? <DocumentsTab employeeId={employee.id} db={db} /> : null}

        {tab === 'onboarding' ? <OnboardingTab employeeId={employee.id} displayName={employee.displayName} db={db} /> : null}

        {tab === 'activity' ? <ActivityTab employeeId={employee.id} /> : null}

        {tab === 'notes' && canNotes ? <NotesTab employeeId={employee.id} db={db} /> : null}
      </Screen>
    </StaffShell>
  );
}

type Db = Parameters<typeof listShiftViews>[0];

async function ScheduleTab({ employeeId, db, now }: { employeeId: string; db: Db; now: Date }) {
  const [upcoming, past, timeOff] = await Promise.all([
    listShiftViews(db, { from: now.toISOString(), to: new Date(now.getTime() + 28 * 86_400_000).toISOString(), employeeId, includeDrafts: true }, { withWarnings: true }),
    listShiftViews(db, { from: new Date(now.getTime() - 28 * 86_400_000).toISOString(), to: now.toISOString(), employeeId, includeCancelled: true }),
    listTimeOff(db, { employeeId }),
  ]);
  return (
    <>
      <Section title="Coming up" count={upcoming.length}>
        {upcoming.length === 0 ? <Empty title="Not scheduled in the next four weeks." /> : <div className="staff-panel px-4">{upcoming.map((shift) => <ShiftRow key={shift.id} shift={shift} href={`/staff/schedule?edit=${shift.id}`} />)}</div>}
      </Section>
      <Section title="Last four weeks" count={past.length}>
        {past.length === 0 ? <p className="text-[0.875rem] text-brown-soft">No shifts.</p> : <div className="staff-panel px-4">{past.reverse().map((shift) => <ShiftRow key={shift.id} shift={shift} href={`/staff/schedule?edit=${shift.id}`} />)}</div>}
      </Section>
      <Section title="Time off" count={timeOff.length}>
        {timeOff.length === 0 ? <p className="text-[0.875rem] text-brown-soft">No requests.</p> : (
          <div className="staff-panel px-4">
            {timeOff.map((request) => (
              <Row key={request.id} title={formatDateRange(request.startsOn, request.endsOn)} detail={request.reason ?? undefined} trailing={<Pill tone={request.status === 'approved' ? 'good' : request.status === 'denied' ? 'bad' : request.status === 'pending' ? 'accent' : 'neutral'}>{request.status}</Pill>} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

async function AvailabilityTab({ employeeId, db }: { employeeId: string; db: Db }) {
  const availability = await listAvailabilityFor(db, employeeId);
  return (
    <>
      <Section title="Weekly">
        {availability.rules.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Not set. Scheduling assumes they are open until they say otherwise.</p> : (
          <div className="staff-panel grid grid-cols-7 gap-1 px-3 py-3 text-center">
            {[0, 1, 2, 3, 4, 5, 6].map((weekday) => {
              const rule = availability.rules.find((entry) => entry.weekday === weekday);
              return (
                <div key={weekday} className={rule && !rule.available ? 'text-brown-soft/50' : 'text-brown'}>
                  <p className="text-[0.75rem] font-semibold">{WEEKDAY_SHORT[weekday]}</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-tight">{rule ? describeRule(rule) : 'Open'}</p>
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="One-off days" count={availability.exceptions.length}>
        {availability.exceptions.length === 0 ? <p className="text-[0.875rem] text-brown-soft">None coming up.</p> : (
          <div className="staff-panel px-4">
            {availability.exceptions.map((exception) => (
              <Row key={exception.id} title={formatDate(exception.onDate)} detail={exception.note ?? undefined} trailing={<Pill tone={exception.available ? 'good' : 'warn'}>{exception.available ? 'Available' : 'Unavailable'}</Pill>} />
            ))}
          </div>
        )}
      </Section>
      <p className="text-[0.8125rem] text-brown-soft">Availability belongs to the employee; you can see it, not change it.</p>
    </>
  );
}

async function TrainingTab({ employeeId, db }: { employeeId: string; db: Db }) {
  const [assignments, modules, employee] = await Promise.all([listAssignments(db, { employeeId }), listModules(db), getEmployee(db, employeeId)]);
  const assigned = new Set(assignments.map((assignment) => assignment.moduleId));
  return (
    <>
      <Section title="Assigned" count={assignments.length}>
        {assignments.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nothing assigned.</p> : (
          <div className="staff-panel px-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="staff-row">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-brown">{assignment.module.title}</span>
                  <span className="block text-[0.8125rem] text-brown-soft">
                    {assignment.status === 'completed' && !assignment.outdated ? `Completed ${assignment.completedAt?.slice(0, 10)}${assignment.score !== null ? ` · ${assignment.score}%` : ''} · v${assignment.completedVersion}` : assignment.dueOn ? `Due ${assignment.dueOn}` : 'No due date'}
                    {assignment.attempts ? ` · ${assignment.attempts} ${assignment.attempts === 1 ? 'attempt' : 'attempts'}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {assignment.status === 'completed' && !assignment.outdated ? <Pill tone="good">Done</Pill> : assignment.overdue ? <Pill tone="bad">Overdue</Pill> : assignment.outdated ? <Pill tone="warn">New version</Pill> : <Pill tone="accent">{assignment.status.replace('_', ' ')}</Pill>}
                  {assignment.status !== 'completed' || assignment.outdated ? (
                    <OneTap action={markTrainingComplete} fields={{ assignmentId: assignment.id }} variant="quiet" quiet confirm="Mark this complete on their behalf? It is recorded in the audit trail.">
                      Mark complete
                    </OneTap>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Assign a module">
        <div className="staff-panel grid gap-3 px-4 py-3">
          {modules.filter((lesson) => !assigned.has(lesson.id)).length === 0 ? <p className="text-[0.875rem] text-brown-soft">Every published module is already assigned.</p> : null}
          {modules
            .filter((lesson) => !assigned.has(lesson.id))
            .map((lesson) => (
              <div key={lesson.id} className="flex items-center justify-between gap-3">
                <span className="text-[0.9375rem] text-brown">{lesson.title}</span>
                {employee ? <AssignTrainingForm moduleId={lesson.id} employees={[employee]} /> : null}
              </div>
            ))}
        </div>
      </Section>
    </>
  );
}

async function DocumentsTab({ employeeId, db }: { employeeId: string; db: Db }) {
  const items = (await listRequirementsFor(db, employeeId, { withFileUrls: true })).filter((item) => item.type.kind !== 'system' && item.type.kind !== 'training_module');
  return (
    <Section title="Documents and certifications" count={items.length}>
      {items.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nothing applies to their positions.</p> : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.type.id} className="grid gap-2">
              <RequirementCard item={item} employeeId={employeeId} forManager />
              {item.type.kind !== 'acknowledgement' && item.type.kind !== 'link' ? (
                <div className="staff-panel px-4 py-3">
                  <VerifyForm employeeId={employeeId} typeId={item.type.id} expiresOn={item.expiresOn} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

async function OnboardingTab({ employeeId, displayName, db }: { employeeId: string; displayName: string; db: Db }) {
  const progress = await onboardingFor(db, employeeId);
  return (
    <>
      <Progress value={progress.complete} max={progress.total} />
      <div className="staff-panel px-4">
        {progress.items.map((item) => (
          <Row key={item.type.id} title={item.type.title} detail={item.type.kind === 'system' ? 'Set by the employee or a manager' : item.type.kind === 'manager_verify' ? 'You verify this' : undefined} trailing={<Pill tone={item.state === 'complete' || item.state === 'waived' || item.state === 'expiring' ? 'good' : item.state === 'submitted' ? 'accent' : 'neutral'}>{item.state === 'complete' || item.state === 'expiring' ? 'Done' : item.state === 'waived' ? 'Waived' : item.state === 'submitted' ? 'Verify' : 'To do'}</Pill>} />
        ))}
      </div>
      <div className="staff-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-[0.9375rem] text-brown">{progress.stage === 'ready' ? `${displayName} has finished everything.` : `${progress.total - progress.complete} left. You can still mark them ready if the rest is handled off the app.`}</p>
        <OneTap action={completeOnboarding} fields={{ employeeId }} variant={progress.stage === 'ready' ? 'primary' : 'secondary'} confirm={progress.stage === 'ready' ? undefined : 'Mark onboarding complete with items still open?'}>
          Ready for first shift
        </OneTap>
      </div>
    </>
  );
}

async function ActivityTab({ employeeId }: { employeeId: string }) {
  const entries = await recentOpsAudit(50, { entityType: 'employee', entityId: employeeId });
  return (
    <Section title="Management activity" count={entries.length}>
      {entries.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nothing recorded yet.</p> : (
        <ul className="staff-panel px-4">
          {entries.map((entry) => (
            <li key={entry.id} className="staff-row text-[0.875rem]">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-brown">{entry.action.replace(/[._]/g, ' ')}</span>
                <span className="block text-brown-soft">{entry.actorName}</span>
              </span>
              <span className="shrink-0 text-brown-soft">{formatRelative(entry.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

async function NotesTab({ employeeId, db }: { employeeId: string; db: Db }) {
  const notes = await listNotes(db, employeeId);
  return (
    <>
      <Section title="Manager notes" count={notes.length}>
        {notes.length === 0 ? <p className="text-[0.875rem] text-brown-soft">No notes.</p> : (
          <div className="staff-panel px-4">
            {notes.map((note) => (
              <div key={note.id} className="staff-row items-start">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[0.8125rem] text-brown-soft">
                    <Pill tone={note.kind === 'recognition' ? 'good' : note.kind === 'attendance' ? 'warn' : 'neutral'}>{note.kind.replace('_', ' ')}</Pill>
                    {note.authorName} · {formatRelative(note.createdAt)}
                  </span>
                  <span className="mt-1 block whitespace-pre-line text-[0.9375rem] text-brown">{note.body}</span>
                </span>
                <OneTap action={removeManagerNote} fields={{ id: note.id }} variant="quiet" quiet confirm="Remove this note?">
                  Remove
                </OneTap>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Add a note">
        <div className="staff-panel px-4 py-3">
          <NoteForm employeeId={employeeId} />
        </div>
      </Section>
    </>
  );
}
