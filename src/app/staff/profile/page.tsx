import { StaffShell } from '@/components/staff/StaffShell';
import { Avatar, Button, Chips, Empty, Facts, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { EMPLOYMENT_TYPE_LABEL, EMPLOYEE_STATUS_LABEL } from '@/content/staff-types';
import { describeRule, listAvailabilityFor } from '@/server/staff/availability';
import { getEmployee, listPositions } from '@/server/staff/employees';
import { listRequirementsFor } from '@/server/staff/requirements';
import { listAssignments, outstanding } from '@/server/staff/training';
import { WEEKDAY_SHORT } from '@/lib/staff/time';
import { isDenied, staffPage } from '../_lib';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

/**
 * Me.
 *
 * Contact details I own, positions and location a manager owns, and the few
 * doors that belong here rather than in the navigation. Deliberately not an
 * HR record: nothing about pay, nothing about anyone else, and the only
 * numbers on it are my own.
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const page = await staffPage('staff.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { edit } = await searchParams;
  const employee = context.employee ? await getEmployee(db, context.employee.id, { withPhoto: true }) : null;
  if (!employee) {
    return (
      <StaffShell context={context} unread={unread}>
        <Screen title={context.staff.name || 'Profile'}>
          <Empty title="No employee profile yet." detail="You have a manager sign-in without an employee record. Add yourself from Team if you also work shifts." action={<Button href="/staff/team/new">Add yourself</Button>} />
        </Screen>
      </StaffShell>
    );
  }
  const [positions, availability, requirements, training] = await Promise.all([listPositions(db), listAvailabilityFor(db, employee.id), listRequirementsFor(db, employee.id), listAssignments(db, { employeeId: employee.id })]);
  const positionName = (id: string) => positions.find((position) => position.id === id)?.name ?? id;
  const docsMissing = requirements.filter((item) => item.type.kind !== 'system' && item.type.required && (item.state === 'missing' || item.state === 'expired')).length;
  const trainingTodo = outstanding(training).length;

  return (
    <StaffShell context={context} unread={unread}>
      <Screen title={employee.displayName} eyebrow={employee.positionIds.map(positionName).join(' · ')}>
        <div className="flex items-center gap-4">
          <Avatar name={employee.fullName} url={employee.photoUrl} size="lg" />
          <div className="text-[0.9375rem] text-brown-soft">
            <p className="text-brown">{employee.fullName}</p>
            <p>{employee.email}</p>
            <p>{employee.phone ?? 'No phone on file'}</p>
          </div>
        </div>
        <Chips
          items={[
            { href: '/staff/profile', label: 'Overview', active: !edit },
            { href: '/staff/profile?edit=1', label: 'Edit details', active: edit === '1' },
            { href: '/staff/availability', label: 'Availability', active: false },
            { href: '/staff/documents', label: 'Documents', active: false, count: docsMissing },
            { href: '/staff/time-off', label: 'Time off', active: false },
          ]}
        />
        {edit ? (
          <ProfileForm employee={employee} />
        ) : (
          <>
            <Facts
              items={[
                { label: 'Status', value: <Pill tone={employee.status === 'active' ? 'good' : 'neutral'}>{EMPLOYEE_STATUS_LABEL[employee.status]}</Pill> },
                { label: 'Employment', value: EMPLOYMENT_TYPE_LABEL[employee.employmentType] },
                { label: 'Location', value: context.location.name },
                { label: 'Started', value: employee.startDate ?? employee.hireDate ?? '—' },
                { label: 'Emergency contact', value: employee.emergencyContactName ? `${employee.emergencyContactName}${employee.emergencyContactRelationship ? ` (${employee.emergencyContactRelationship})` : ''} · ${employee.emergencyContactPhone ?? ''}` : 'Not set — worth adding' },
                { label: 'Shirt size', value: employee.shirtSize ?? 'Not set' },
              ]}
            />
            <Section title="Availability" action={<a href="/staff/availability" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">Change</a>}>
              {availability.rules.length === 0 ? (
                <p className="text-[0.875rem] text-brown-soft">Not set yet — managers will assume you’re open until you say otherwise.</p>
              ) : (
                <div className="staff-panel grid grid-cols-7 gap-1 px-3 py-3 text-center">
                  {[0, 1, 2, 3, 4, 5, 6].map((weekday) => {
                    const rule = availability.rules.find((entry) => entry.weekday === weekday);
                    const off = rule ? !rule.available : false;
                    return (
                      <div key={weekday} className={off ? 'text-brown-soft/50' : 'text-brown'}>
                        <p className="text-[0.75rem] font-semibold">{WEEKDAY_SHORT[weekday]}</p>
                        <p className="mt-0.5 text-[0.6875rem] leading-tight">{rule ? describeRule(rule) : 'Open'}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
            <Section title="Everything else">
              <div className="staff-panel px-4">
                <Row href="/staff/documents" title="Documents & certifications" detail={docsMissing ? `${docsMissing} need attention` : 'All in order'} icon="documents" trailing={docsMissing ? <Pill tone="warn">{docsMissing}</Pill> : null} />
                <Row href="/staff/training" title="Training" detail={trainingTodo ? `${trainingTodo} to do` : 'All caught up'} icon="training" trailing={trainingTodo ? <Pill tone="accent">{trainingTodo}</Pill> : null} />
                <Row href="/staff/time-off" title="Time off" detail="Ask for a day, and see what was decided" icon="calendar" />
                <Row href="/staff/tasks" title="Your list" detail="Everything assigned to you" icon="tasks" />
                <Row href="/staff/incidents/new" title="Report something" detail="A guest issue, an injury, damage. Goes to the managers." icon="incidents" />
                {!employee.onboardingCompletedAt ? <Row href="/staff/onboarding" title="Onboarding" detail="Finish it before your first shift" icon="check" /> : null}
              </div>
            </Section>
          </>
        )}
      </Screen>
    </StaffShell>
  );
}
