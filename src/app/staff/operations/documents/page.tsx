import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Chips, Empty, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { formatDate } from '@/lib/staff/time';
import { listEmployees } from '@/server/staff/employees';
import { listRequirementTypes, requirementOverview } from '@/server/staff/requirements';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/** Documents and certifications across the team: what is missing, expiring, expired, waiting. */
export default async function DocumentsDashboardPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('documents.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const [employees, types] = await Promise.all([listEmployees(db), listRequirementTypes(db)]);
  const overview = await requirementOverview(db, employees.map((employee) => employee.id));
  const name = (id: string) => employees.find((employee) => employee.id === id)?.displayName ?? 'Employee';
  const buckets = { submitted: [] as { employeeId: string; title: string; detail: string }[], expiring: [] as { employeeId: string; title: string; detail: string }[], expired: [] as { employeeId: string; title: string; detail: string }[], missing: [] as { employeeId: string; title: string; detail: string }[] };
  for (const entry of overview.values()) {
    for (const item of entry.submitted) buckets.submitted.push({ employeeId: entry.employeeId, title: item.type.title, detail: `Uploaded ${item.submittedAt ? formatDate(item.submittedAt.slice(0, 10), 'short') : ''}` });
    for (const item of entry.expiring) buckets.expiring.push({ employeeId: entry.employeeId, title: item.type.title, detail: `Expires ${item.expiresOn ? formatDate(item.expiresOn, 'short') : ''}` });
    for (const item of entry.expired) buckets.expired.push({ employeeId: entry.employeeId, title: item.type.title, detail: `Expired ${item.expiresOn ? formatDate(item.expiresOn, 'short') : ''}` });
    for (const item of entry.missing.filter((requirement) => requirement.type.kind !== 'system')) buckets.missing.push({ employeeId: entry.employeeId, title: item.type.title, detail: item.type.kind === 'manager_verify' ? 'You verify this' : 'Employee has not done it' });
  }
  const tab = (show && show in buckets ? show : 'submitted') as keyof typeof buckets;
  const list = buckets[tab];
  const tone = { submitted: 'accent', expiring: 'warn', expired: 'bad', missing: 'neutral' } as const;

  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations" label="Operations" />
      <Screen title="Documents" lead={`${types.filter((type) => type.kind !== 'system').length} requirements configured.`} actions={<Button href="/staff/operations/documents/types">Configure requirements</Button>}>
        <Chips
          items={[
            { href: '/staff/operations/documents?show=submitted', label: 'To verify', active: tab === 'submitted', count: buckets.submitted.length },
            { href: '/staff/operations/documents?show=expiring', label: 'Expiring soon', active: tab === 'expiring', count: buckets.expiring.length },
            { href: '/staff/operations/documents?show=expired', label: 'Expired', active: tab === 'expired', count: buckets.expired.length },
            { href: '/staff/operations/documents?show=missing', label: 'Missing', active: tab === 'missing', count: buckets.missing.length },
          ]}
        />
        {list.length === 0 ? <Empty title={tab === 'submitted' ? 'Nothing waiting for you.' : tab === 'expiring' ? 'Nothing expiring in the next 30 days.' : tab === 'expired' ? 'Nothing expired.' : 'Nothing missing.'} /> : (
          <Section title={tab}>
            <div className="staff-panel px-4">
              {list.map((item, index) => (
                <Row key={`${item.employeeId}-${item.title}-${index}`} href={`/staff/team/${item.employeeId}?tab=documents`} title={`${name(item.employeeId)} · ${item.title}`} detail={item.detail} trailing={<Pill tone={tone[tab]}>{tab}</Pill>} />
              ))}
            </div>
          </Section>
        )}
        <p className="text-[0.8125rem] text-brown-soft">
          Every file lives in private storage and is opened through a short-lived link from a person’s <Link href="/staff/team" className="underline underline-offset-4">profile</Link>.
        </p>
      </Screen>
    </StaffShell>
  );
}
