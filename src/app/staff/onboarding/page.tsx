import Link from 'next/link';
import { RequirementCard, STATE_PILL, systemHref } from '@/components/staff/RequirementCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Empty, Pill, Progress, Screen } from '@/components/staff/ui';
import { onboardingFor } from '@/server/staff/requirements';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';


export default async function OnboardingPage() {
  const page = await staffPage('staff.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const employee = context.employee;
  const progress = employee ? await onboardingFor(db, employee.id) : null;

  return (
    <StaffShell context={context} unread={unread}>
      <Screen title={progress?.stage === 'ready' ? 'You’re ready.' : `Welcome to Cosa Nostra${employee ? `, ${employee.displayName}` : ''}.`} lead={progress?.stage === 'ready' ? 'Everything on your checklist is done. Your manager confirms your first shift from here.' : 'A few things before your first shift. Most take a minute; do them in any order.'}>
        {!progress ? <Empty title="No employee profile." /> : null}
        {progress ? (
          <>
            <Progress value={progress.complete} max={progress.total} />
            <div className="grid gap-3">
              {progress.items.map((item) => {
                const done = item.state === 'complete' || item.state === 'expiring' || item.state === 'waived';
                if (item.type.kind === 'system') {
                  const href = systemHref(item.type.systemKey);
                  const pill = STATE_PILL[item.state];
                  const body = (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] font-semibold text-brown">{item.type.title}</p>
                        <p className="mt-0.5 text-[0.875rem] text-brown-soft">{item.type.description}</p>
                      </div>
                      <Pill tone={pill.tone}>{done ? 'Done' : href ? 'Do it' : 'Manager'}</Pill>
                    </div>
                  );
                  return href && !done ? (
                    <Link key={item.type.id} href={href} className="staff-panel block px-4 py-3.5 active:bg-brown/6">
                      {body}
                    </Link>
                  ) : (
                    <div key={item.type.id} className="staff-panel px-4 py-3.5">
                      {body}
                    </div>
                  );
                }
                return <RequirementCard key={item.type.id} item={item} employeeId={employee!.id} />;
              })}
            </div>
          </>
        ) : null}
      </Screen>
    </StaffShell>
  );
}
