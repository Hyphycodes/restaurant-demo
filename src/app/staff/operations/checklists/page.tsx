import { StartRunForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Empty, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { addDays, formatDate, zonedDate } from '@/lib/staff/time';
import { listRuns, listTemplates } from '@/server/staff/checklists';
import { listEmployees } from '@/server/staff/employees';
import { eventOptionsFor, isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/** Checklists: today's runs, live, and the templates behind them. */
export default async function ChecklistsPage() {
  const page = await staffPage('checklists.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const today = zonedDate(new Date(), context.location.timezone);
  const [templates, runs, employees, events] = await Promise.all([listTemplates(db, { includeInactive: true }), listRuns(db, { from: addDays(today, -7), to: addDays(today, 2) }), listEmployees(db), eventOptionsFor(db, context.location.timezone, 14)]);
  const todays = runs.filter((run) => run.onDate === today);
  const recent = runs.filter((run) => run.onDate !== today);
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations" label="Operations" />
      <Screen title="Checklists" actions={<Button href="/staff/operations/checklists/templates/new" variant="primary">New checklist</Button>}>
        <Section title="Start one">
          {templates.filter((template) => template.active).length === 0 ? <Empty title="No checklists yet." detail="Create Opening, Closing and Event night setup to start." /> : (
            <div className="staff-panel px-4 py-3">
              <StartRunForm templates={templates.filter((template) => template.active)} employees={employees} events={events} date={today} locationId={context.location.id} />
            </div>
          )}
        </Section>
        <Section title={`Today · ${formatDate(today, 'short')}`} count={todays.length}>
          {todays.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nothing running today.</p> : (
            <div className="staff-panel px-4">
              {todays.map((run) => (
                <Row key={run.id} href={`/staff/checklists/${run.id}`} title={run.title} detail={`${run.done} of ${run.total}${run.assignedEmployeeName ? ` · ${run.assignedEmployeeName}` : ' · anyone on shift'}${run.eventTitle ? ` · ${run.eventTitle}` : ''}`} trailing={run.status === 'verified' ? <Pill tone="good">Verified</Pill> : run.status === 'complete' ? <Pill tone="accent">Verify</Pill> : <Pill>{run.done}/{run.total}</Pill>} />
              ))}
            </div>
          )}
        </Section>
        {recent.length > 0 ? (
          <Section title="Last week" count={recent.length}>
            <div className="staff-panel px-4">
              {recent.map((run) => (
                <Row key={run.id} href={`/staff/checklists/${run.id}`} title={`${formatDate(run.onDate, 'short')} · ${run.title}`} detail={`${run.done} of ${run.total}`} trailing={run.status === 'verified' ? <Pill tone="good">Verified</Pill> : run.done === run.total ? <Pill tone="good">Complete</Pill> : <Pill tone="warn">Unfinished</Pill>} />
              ))}
            </div>
          </Section>
        ) : null}
        <Section title="Templates" count={templates.length}>
          <div className="staff-panel px-4">
            {templates.map((template) => (
              <Row key={template.id} href={`/staff/operations/checklists/templates/${template.id}`} title={template.title} detail={`${template.items.length} lines · ${template.kind}${template.positionId ? ` · ${template.positionId}` : ''}`} trailing={!template.active ? <Pill>Archived</Pill> : null} />
            ))}
          </div>
        </Section>
      </Screen>
    </StaffShell>
  );
}
