import { RequirementCard } from '@/components/staff/RequirementCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Empty, Screen, Section } from '@/components/staff/ui';
import { listRequirementsFor } from '@/server/staff/requirements';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/** My documents: policies to acknowledge, certificates to upload, and where each stands. */
export default async function DocumentsPage() {
  const page = await staffPage('documents.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const employee = context.employee;
  const items = employee ? (await listRequirementsFor(db, employee.id, { withFileUrls: true })).filter((item) => item.type.kind !== 'system' && item.type.kind !== 'training_module') : [];
  const attention = items.filter((item) => item.state === 'missing' || item.state === 'expired' || item.state === 'expiring');
  const waiting = items.filter((item) => item.state === 'submitted');
  const done = items.filter((item) => item.state === 'complete' || item.state === 'waived');

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/profile" label="Profile" />
      <Screen title="Documents" lead="Only you and managers can see these. Files are stored privately and never get a public link.">
        {!employee ? <Empty title="No employee profile." /> : null}
        {employee && items.length === 0 ? <Empty title="Nothing to do." detail="There are no documents or policies for your positions yet." /> : null}
        {attention.length > 0 ? (
          <Section title="Needs you" count={attention.length}>
            <div className="grid gap-3">
              {attention.map((item) => (
                <RequirementCard key={item.type.id} item={item} employeeId={employee!.id} />
              ))}
            </div>
          </Section>
        ) : null}
        {waiting.length > 0 ? (
          <Section title="Waiting for a manager" count={waiting.length}>
            <div className="grid gap-3">
              {waiting.map((item) => (
                <RequirementCard key={item.type.id} item={item} employeeId={employee!.id} />
              ))}
            </div>
          </Section>
        ) : null}
        {done.length > 0 ? (
          <Section title="Complete" count={done.length}>
            <div className="grid gap-3">
              {done.map((item) => (
                <RequirementCard key={item.type.id} item={item} employeeId={employee!.id} />
              ))}
            </div>
          </Section>
        ) : null}
      </Screen>
    </StaffShell>
  );
}
