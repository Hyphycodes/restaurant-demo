import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { formatDateRange, formatRelative } from '@/lib/staff/time';
import { cancelTimeOff } from '@/server/actions/staff/timeoff';
import { listTimeOff } from '@/server/staff/timeoff';
import { isDenied, staffPage } from '../_lib';
import { RequestTimeOff } from './RequestTimeOff';

export const dynamic = 'force-dynamic';

const TONE = { pending: 'accent', approved: 'good', denied: 'bad', cancelled: 'neutral' } as const;

export default async function TimeOffPage() {
  const page = await staffPage('timeoff.request');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const employee = context.employee;
  const requests = employee ? await listTimeOff(db, { employeeId: employee.id }) : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/schedule" label="Schedule" />
      <Screen title="Time off">
        <Section title="Request time off">
          <div className="staff-panel px-4 py-4">
            <RequestTimeOff today={today} />
          </div>
        </Section>
        <Section title="Your requests" count={requests.length}>
          {requests.length === 0 ? (
            <Empty title="No requests yet." />
          ) : (
            <div className="staff-panel px-4">
              {requests.map((request) => (
                <div key={request.id} className="staff-row">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">{formatDateRange(request.startsOn, request.endsOn)}</span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {request.reason ?? 'No reason given'} · asked {formatRelative(request.createdAt)}
                    </span>
                    {request.decisionNote ? <span className="mt-1 block text-[0.875rem] text-brown">“{request.decisionNote}”</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Pill tone={TONE[request.status]}>{request.status}</Pill>
                    {request.status === 'pending' ? (
                      <OneTap action={cancelTimeOff} fields={{ id: request.id }} variant="quiet" quiet>
                        Withdraw
                      </OneTap>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </Screen>
    </StaffShell>
  );
}
