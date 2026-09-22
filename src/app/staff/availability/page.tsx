import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Empty, Screen } from '@/components/staff/ui';
import { listAvailabilityFor } from '@/server/staff/availability';
import { isDenied, staffPage } from '../_lib';
import { AvailabilityForm } from './AvailabilityForm';

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage() {
  const page = await staffPage('availability.manage_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const employee = context.employee;
  const availability = employee ? await listAvailabilityFor(db, employee.id) : { rules: [], exceptions: [] };
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/schedule" label="Schedule" />
      <Screen title="Availability" lead="The days and times you can work. Managers see a warning if they schedule you outside them — and they can still ask.">
        {employee ? <AvailabilityForm rules={availability.rules} exceptions={availability.exceptions} /> : <Empty title="No employee profile." />}
      </Screen>
    </StaffShell>
  );
}
