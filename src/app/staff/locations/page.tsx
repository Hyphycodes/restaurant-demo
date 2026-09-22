import { LocationForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Pill, Row, Screen, Section } from '@/components/staff/ui';
import { listEmployees } from '@/server/staff/employees';
import { listLocations } from '@/server/staff/locations';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';


export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const page = await staffPage('locations.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { edit } = await searchParams;
  const [locations, employees] = await Promise.all([listLocations(db), listEmployees(db)]);
  const editing = edit ? locations.find((location) => location.id === edit) ?? null : null;
  return (
    <StaffShell context={context} unread={unread}>
      <Screen title="Locations" lead="Chicago today. Joliet is a row here, not a rebuild: employees, shifts, events, tasks and announcements can all belong to it.">
        <Section title="Operating" count={locations.length}>
          <div className="staff-panel px-4">
            {locations.map((location) => (
              <Row key={location.id} href={`/staff/locations?edit=${location.id}`} title={location.name} detail={`${location.timezone} · ${employees.filter((employee) => employee.primaryLocationId === location.id).length} employees based here`} trailing={location.active ? <Pill tone="good">Active</Pill> : <Pill>Inactive</Pill>} />
            ))}
          </div>
        </Section>
        <Section title={editing ? `Edit ${editing.name}` : 'Add a location'} action={editing ? <a href="/staff/locations" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">New instead</a> : undefined}>
          <div className="staff-panel px-4 py-4">
            <LocationForm key={editing?.id ?? 'new'} location={editing} />
          </div>
        </Section>
      </Screen>
    </StaffShell>
  );
}
