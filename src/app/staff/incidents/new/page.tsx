import { IncidentForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listEmployees } from '@/server/staff/employees';
import { contextCan } from '@/server/staff/session';
import { eventOptionsFor, isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/**
 * Reporting something.
 *
 * Open to anyone who works here, because the person who saw it is the
 * person who should write it down, and "ask a manager to log it" is how
 * things stop being logged. What an employee writes goes straight to the
 * managers and nowhere else — they cannot then read the log, including
 * their own entry, which is the honest version of a private record.
 */
export default async function NewIncidentPage() {
  const page = await staffPage('incidents.report');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const reviews = contextCan(context, 'incidents.manage');
  const [employees, events] = reviews
    ? await Promise.all([listEmployees(db, { includeInactive: true }), eventOptionsFor(db, context.location.timezone, 30)])
    : [[], []];
  return (
    <StaffShell context={context} unread={unread}>
      <Back href={reviews ? '/staff/incidents' : '/staff'} label={reviews ? 'Incidents' : 'Home'} />
      <Screen
        title={reviews ? 'Record an incident' : 'Report something'}
        lead={
          reviews
            ? 'Facts, in order, while they are fresh. Attachments are stored privately.'
            : 'A guest issue, an injury, damage, anything that needs a manager to know. It goes to the managers on duty and is not visible to your coworkers.'
        }
      >
        <IncidentForm incident={null} employees={employees} locations={context.locations} events={events} defaultLocationId={context.location.id} review={reviews} />
      </Screen>
    </StaffShell>
  );
}
