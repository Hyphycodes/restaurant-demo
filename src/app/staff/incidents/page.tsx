import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Chips, Empty, Pill, Row, Screen } from '@/components/staff/ui';
import { INCIDENT_CATEGORY_LABEL } from '@/content/staff-types';
import { formatClock, formatDayShort } from '@/lib/staff/time';
import { listIncidents } from '@/server/staff/incidents';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('incidents.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const incidents = await listIncidents(db, { limit: 200 });
  const list = show === 'closed' ? incidents.filter((incident) => incident.followUpStatus === 'closed') : incidents.filter((incident) => incident.followUpStatus !== 'closed');
  return (
    <StaffShell context={context} unread={unread} wide>
      <Screen title="Incidents" lead="Manager-only. Employees never see this log, including entries they are named in." actions={<Button href="/staff/incidents/new" variant="primary">Record incident</Button>}>
        <Chips items={[{ href: '/staff/incidents', label: 'Open', active: show !== 'closed', count: incidents.filter((incident) => incident.followUpStatus !== 'closed').length }, { href: '/staff/incidents?show=closed', label: 'Closed', active: show === 'closed' }]} />
        {list.length === 0 ? <Empty title={show === 'closed' ? 'Nothing closed yet.' : 'Nothing open.'} /> : (
          <div className="staff-panel px-4">
            {list.map((incident) => (
              <Row key={incident.id} href={`/staff/incidents/${incident.id}`} title={incident.summary} detail={`${INCIDENT_CATEGORY_LABEL[incident.category]} · ${formatDayShort(incident.occurredAt, context.location.timezone)} ${formatClock(incident.occurredAt, context.location.timezone)}${incident.eventTitle ? ` · ${incident.eventTitle}` : ''}${incident.employees.length ? ` · ${incident.employees.map((entry) => entry.name).join(', ')}` : ''}`} trailing={<Pill tone={incident.followUpStatus === 'open' ? 'warn' : incident.followUpStatus === 'monitoring' ? 'accent' : 'neutral'}>{incident.followUpStatus}</Pill>} />
            ))}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
