import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, HelpNote, LinkButton } from '@/components/admin/ui';
import { EMAIL_TEMPLATES } from '@/emails/registry';
import { isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { emailConfig } from '@/server/email/config';
import { listEventsForEmail } from '@/server/email/data';
import { recentEmailLog, type EmailLogRow } from '@/server/email/log';
import { canOpen } from '@/server/permissions';
import { isTicketingConfigured } from '@/server/ticketing/db';
import { EventUpdateForm, PreviewAndTest } from './CommunicationsPanel';

export const dynamic = 'force-dynamic';

/**
 * Sending & log: whether email can go out at all, one preview against a
 * real event, a test to one address, the one operational send a manager
 * legitimately needs, and what actually went out.
 *
 * The wall of templates and the on/off switches live next door on Emails.
 * This screen is the working end: configuration, a test, a send, a record.
 */
export default async function CommunicationsPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return (
      <AdminShell staff={staff} local={local} title="Sending &amp; log">
        <NoAccess what="emails" />
      </AdminShell>
    );
  }

  const canSend = staffCan(staff, 'content.publish');
  const config = emailConfig();
  const [events, log] = await Promise.all([listEventsForEmail().catch(() => []), recentEmailLog(60).catch(() => [])]);
  const mailerReady = config.transportConfigured && Boolean(config.from);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Sending &amp; log"
      description="Whether Cosa Nostra can send email at all, a test to one address, the one send a manager makes on purpose, and everything that has gone out."
      backTo={{ href: '/admin/emails', label: 'Emails' }}
      actions={<LinkButton href="/admin/emails">See every email</LinkButton>}
    >
      <div className="grid gap-5">
        <Card title="Status">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Status
              ok={mailerReady}
              label="Sending"
              detail={mailerReady ? `From ${config.fromAddress}${config.replyTo ? ` · replies to ${config.replyTo}` : ''}` : config.transportConfigured ? (config.fromProblem ?? 'Sender not set.') : 'RESEND_API_KEY is not set. Nothing can be sent, tests included.'}
            />
            <Status
              ok={config.deliveryEnabled}
              label="Emailing guests"
              detail={
                config.deliveryEnabled
                  ? `On. Tickets, reminders, refunds and changes go out automatically.${config.redirectTo ? ` Every guest email is redirected to ${config.redirectTo}.` : ''}`
                  : 'Off (EMAIL_DELIVERY_ENABLED). Guest emails are logged as skipped, not sent. Tests and staff invitations still work.'
              }
              neutral={!config.deliveryEnabled}
            />
            <Status ok={config.webhookSecretSet} label="Delivery reports" detail={config.webhookSecretSet ? 'Resend reports delivered, bounced and delayed back to this log.' : 'RESEND_WEBHOOK_SECRET not set: the log records sends, not deliveries.'} neutral={!config.webhookSecretSet} />
            <Status ok={config.authHookSecretSet} label="Staff sign-in emails" detail={config.authHookSecretSet ? 'Sent as Cosa Nostra emails through the Supabase auth hook.' : 'Supabase sends its own plain sign-in and invitation emails until the auth hook is pointed here.'} neutral={!config.authHookSecretSet} />
          </dl>
          {!isTicketingConfigured() ? <div className="mt-4"><HelpNote>Ticketing is not connected on this copy of the site, so there are no orders to email and the log is empty. Previews still work against the built-in events.</HelpNote></div> : null}
        </Card>

        <Card title="Preview & test">
          <PreviewAndTest templates={EMAIL_TEMPLATES} events={events} defaultTicketDirection={config.ticketDirection} canSend={canSend && mailerReady} staffEmail={staff.email} />
        </Card>

        {canSend ? (
          <Card title="Tell ticket holders about a change">
            <p className="measure mb-4 text-[0.9375rem] leading-relaxed text-brown-soft">
              For a time, date or venue change, a postponement, or news they need. Cancelling an event emails everyone automatically from the event editor; it is not done here.
            </p>
            <EventUpdateForm events={events} enabled={config.deliveryEnabled && mailerReady} />
          </Card>
        ) : null}

        <Card title="Every email the site sends" action={<LinkButton href="/admin/emails" variant="quiet">See them all, and their switches →</LinkButton>}>
          <ul className="divide-y divide-brown/10">
            {EMAIL_TEMPLATES.map((template) => (
              <li key={template.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start">
                <div>
                  <p className="text-[0.9375rem] font-semibold text-brown">{template.name}</p>
                  <p className="text-[0.8125rem] text-brown-soft">{template.category}</p>
                </div>
                <p className="text-[0.875rem] leading-relaxed text-brown-soft">{template.trigger}</p>
                <Wiring wiring={template.wiring} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-brown-soft">
            Designs live in code (<code>src/emails/</code>). <a href="/admin/emails" className="text-clay underline underline-offset-4">Emails</a> draws all of them at once and holds the switches; <code>npm run email:dev</code> adds the awkward scenarios. docs/email-system.md explains the rest.
          </p>
        </Card>

        <Card title="Recent sends">
          {log.length === 0 ? (
            <EmptyState>Nothing has been sent or attempted yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-brown/10">
              {log.map((row) => (
                <LogRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function Status({ ok, label, detail, neutral = false }: { ok: boolean; label: string; detail: string; neutral?: boolean }) {
  const chip = ok ? 'border-success/40 bg-success/10 text-success' : neutral ? 'border-brown/30 bg-brown/8 text-brown-soft' : 'border-warning/50 bg-warning/10 text-warning';
  return (
    <div className="rounded-(--radius-md) border border-brown/12 bg-ivory px-4 py-3">
      <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-brown">
        {label}
        <span className={`inline-flex items-center rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${chip}`}>{ok ? 'On' : 'Off'}</span>
      </dt>
      <dd className="mt-1 text-[0.8125rem] leading-relaxed text-brown-soft">{detail}</dd>
    </div>
  );
}

function Wiring({ wiring }: { wiring: 'live' | 'manual' | 'template' | 'off' }) {
  const style = {
    live: ['border-success/40 bg-success/10 text-success', 'Wired'],
    manual: ['border-brown/30 bg-brown/8 text-brown', 'On request'],
    template: ['border-brown/30 bg-brown/8 text-brown-soft', 'Template only'],
    off: ['border-warning/50 bg-warning/10 text-warning', 'Built, off'],
  }[wiring];
  return <span className={`inline-flex shrink-0 items-center rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${style[0]}`}>{style[1]}</span>;
}

const STATUS_STYLE: Record<string, string> = {
  sent: 'text-brown',
  delivered: 'text-success',
  delayed: 'text-warning',
  skipped: 'text-brown-soft',
  failed: 'text-danger',
  bounced: 'text-danger',
  complained: 'text-danger',
};

function LogRow({ row }: { row: EmailLogRow }) {
  const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(row.createdAt));
  return (
    <li className="grid gap-x-4 gap-y-0.5 py-2.5 text-[0.875rem] sm:grid-cols-[8rem_minmax(0,1fr)_7rem] sm:items-baseline">
      <p className="tabular text-brown-soft">{when}</p>
      <div className="min-w-0">
        <p className="truncate text-brown">
          <span className="font-semibold">{row.type.replace(/_/g, ' ')}</span>
          {row.isTest ? <span className="ml-2 rounded-(--radius-sm) bg-amber/20 px-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brown">test</span> : null}
          {' '}<span className="text-brown-soft">to {row.toEmail ?? '—'}</span>
        </p>
        {row.error ? <p className="truncate text-[0.8125rem] text-brown-soft">{row.error}</p> : null}
      </div>
      <p className={`font-semibold ${STATUS_STYLE[row.status] ?? 'text-brown'}`}>{row.status}</p>
    </li>
  );
}

