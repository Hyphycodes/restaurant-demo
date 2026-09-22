import { notFound } from 'next/navigation';
import { Comments } from '@/components/staff/Comments';
import { IncidentForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Chips, Facts, Pill, Screen, Section } from '@/components/staff/ui';
import { INCIDENT_CATEGORY_LABEL } from '@/content/staff-types';
import { formatClock, formatDayLong } from '@/lib/staff/time';
import { listComments } from '@/server/staff/comments';
import { listEmployees } from '@/server/staff/employees';
import { getIncident } from '@/server/staff/incidents';
import { signedEmployeeFileUrl } from '@/server/staff/storage';
import { eventOptionsFor, isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const page = await staffPage('incidents.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const { tab } = await searchParams;
  const incident = await getIncident(db, id);
  if (!incident) notFound();
  const [employees, events, comments, attachments] = await Promise.all([listEmployees(db, { includeInactive: true }), eventOptionsFor(db, context.location.timezone, 30), listComments(db, 'incident', id, context.staff.id), Promise.all(incident.attachmentPaths.map(async (path) => ({ path, url: await signedEmployeeFileUrl(path) })))]);
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/incidents" label="Incidents" />
      <Screen title={incident.summary} eyebrow={INCIDENT_CATEGORY_LABEL[incident.category]}>
        <Chips items={[{ href: `/staff/incidents/${id}`, label: 'Record', active: tab !== 'edit' }, { href: `/staff/incidents/${id}?tab=edit`, label: 'Edit', active: tab === 'edit' }]} />
        {tab === 'edit' ? (
          <IncidentForm incident={incident} employees={employees} locations={context.locations} events={events} defaultLocationId={context.location.id} />
        ) : (
          <>
            <Facts
              items={[
                { label: 'When', value: `${formatDayLong(incident.occurredAt, context.location.timezone)}, ${formatClock(incident.occurredAt, context.location.timezone)}` },
                { label: 'Event', value: incident.eventTitle ?? '—' },
                { label: 'Reported by', value: incident.reporterName },
                { label: 'Follow-up', value: <Pill tone={incident.followUpStatus === 'open' ? 'warn' : incident.followUpStatus === 'monitoring' ? 'accent' : 'neutral'}>{incident.followUpStatus}</Pill> },
                { label: 'Employees involved', value: incident.employees.length ? incident.employees.map((entry) => `${entry.name} (${entry.involvement})`).join(', ') : 'None named' },
              ]}
            />
            {incident.description ? (
              <Section title="What happened">
                <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">{incident.description}</p>
              </Section>
            ) : null}
            {incident.actionsTaken ? (
              <Section title="Actions taken">
                <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">{incident.actionsTaken}</p>
              </Section>
            ) : null}
            {attachments.length > 0 ? (
              <Section title="Attachments" count={attachments.length}>
                <ul className="staff-panel px-4">
                  {attachments.map((attachment) => (
                    <li key={attachment.path} className="staff-row text-[0.9375rem]">
                      {attachment.url ? (
                        <a href={attachment.url} target="_blank" rel="noreferrer" className="font-semibold text-brown underline underline-offset-4">
                          {attachment.path.split('/').pop()} ↗
                        </a>
                      ) : (
                        <span className="text-brown-soft">{attachment.path.split('/').pop()}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <Comments entityType="incident" entityId={id} comments={comments} />
          </>
        )}
      </Screen>
    </StaffShell>
  );
}
