import { ActionForm, Field, OneTap, SubmitButton, TextInput } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Chips, Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { formatDateRange, formatRelative, zonedDate } from '@/lib/staff/time';
import { shiftsDuringTimeOff } from '@/lib/staff/conflicts';
import { decideTimeOffRequest } from '@/server/actions/staff/timeoff';
import { listShifts } from '@/server/staff/schedule';
import { listTimeOff } from '@/server/staff/timeoff';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

const TONE = { pending: 'accent', approved: 'good', denied: 'bad', cancelled: 'neutral' } as const;

export default async function ManageTimeOffPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('timeoff.approve');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const all = await listTimeOff(db);
  const pending = all.filter((request) => request.status === 'pending');
  const decided = all.filter((request) => request.status !== 'pending');
  const timezone = context.location.timezone;
  const today = zonedDate(new Date(), timezone);
  const shifts = await listShifts(db, { from: new Date().toISOString(), to: new Date(Date.now() + 120 * 86_400_000).toISOString() });
  const list = show === 'history' ? decided : pending;

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/operations" label="Operations" />
      <Screen title="Time off">
        <Chips items={[{ href: '/staff/operations/time-off', label: 'Pending', active: show !== 'history', count: pending.length }, { href: '/staff/operations/time-off?show=history', label: 'History', active: show === 'history' }]} />
        {list.length === 0 ? <Empty title={show === 'history' ? 'No decided requests yet.' : 'No pending requests.'} /> : null}
        <div className="grid gap-3">
          {list.map((request) => {
            const booked = shiftsDuringTimeOff(shifts.filter((shift) => shift.employeeId === request.employeeId), request.startsOn, request.endsOn, timezone);
            const own = request.employeeId === context.employee?.id;
            return (
              <div key={request.id} className="staff-panel px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[1rem] font-semibold text-brown">
                      {request.employeeName} · {formatDateRange(request.startsOn, request.endsOn)}
                    </p>
                    <p className="mt-0.5 text-[0.875rem] text-brown-soft">
                      {request.reason ?? 'No reason given'} · asked {formatRelative(request.createdAt)}
                      {request.startsOn < today ? ' · in the past' : ''}
                    </p>
                    {request.note ? <p className="mt-1 text-[0.875rem] text-brown">“{request.note}”</p> : null}
                    {request.decisionNote ? <p className="mt-1 text-[0.875rem] text-brown-soft">Decision: “{request.decisionNote}”</p> : null}
                  </div>
                  <Pill tone={TONE[request.status]}>{request.status}</Pill>
                </div>
                {booked.length > 0 ? <p className="mt-2 rounded-(--radius-sm) border border-warning/50 bg-warning/8 px-3 py-2 text-[0.875rem] text-warning">Already scheduled {booked.length} {booked.length === 1 ? 'shift' : 'shifts'} in those days. Approving keeps them on the schedule with a warning; move them yourself.</p> : null}
                {request.status === 'pending' ? (
                  own ? (
                    <p className="mt-3 text-[0.875rem] text-brown-soft">This is your own request. Another manager has to decide it.</p>
                  ) : (
                    <Section>
                      <ActionForm action={decideTimeOffRequest} className="mt-3 flex flex-wrap items-end gap-2 border-t border-brown/10 pt-3">
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <div className="min-w-48 flex-1">
                          <Field id={`note-${request.id}`} label="Note to them" hint="Optional.">
                            <TextInput id={`note-${request.id}`} name="note" maxLength={300} />
                          </Field>
                        </div>
                        <SubmitButton>Approve</SubmitButton>
                      </ActionForm>
                      <div className="mt-2">
                        <OneTap action={decideTimeOffRequest} fields={{ id: request.id, decision: 'denied' }} variant="quiet">
                          Deny
                        </OneTap>
                      </div>
                    </Section>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </Screen>
    </StaffShell>
  );
}
