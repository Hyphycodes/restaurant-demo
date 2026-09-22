import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { HelpNote, LinkButton } from '@/components/admin/ui';
import { EMAIL_TEMPLATES } from '@/emails/registry';
import { isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { emailConfig } from '@/server/email/config';
import { listEventsForEmail } from '@/server/email/data';
import { emailSwitches } from '@/server/email/settings';
import { canOpen } from '@/server/permissions';
import { isTicketingConfigured } from '@/server/ticketing/db';
import { EmailGallery } from './EmailGallery';

export const dynamic = 'force-dynamic';

/**
 * Emails: every email the site can send, on one wall.
 *
 * The landing screen of its own section rather than a tab under Events,
 * because this is where somebody goes to answer two questions that have
 * nothing to do with a particular night — what does this email look like,
 * and is it switched on. Sending & log is next door for the working end:
 * status, a test to one address, the one manual send, what went out.
 *
 * Every tile is the real render, from the same route the test send uses,
 * so nothing here can drift from what a guest receives.
 */
export default async function EmailsPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return (
      <AdminShell staff={staff} local={local} title="Emails">
        <NoAccess what="emails" />
      </AdminShell>
    );
  }

  const config = emailConfig();
  const [events, switches] = await Promise.all([listEventsForEmail().catch(() => []), emailSwitches()]);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Emails"
      description="Every email the site can send, rendered against real event data. Click any of them to see it full size, and switch the optional ones on or off."
      actions={<LinkButton href="/admin/emails/sending">Sending &amp; log</LinkButton>}
    >
      <div className="grid gap-5">
        {events.length === 0 && isTicketingConfigured() ? (
          <HelpNote>There are no events to preview against, so the ticket, reminder, refund and change emails cannot be drawn. Publish an event and they will appear here.</HelpNote>
        ) : null}
        <EmailGallery
          templates={EMAIL_TEMPLATES}
          events={events}
          defaultTicketDirection={config.ticketDirection}
          switches={switches}
          canSwitch={staffCan(staff, 'content.publish')}
        />
        <p className="text-[0.8125rem] leading-relaxed text-brown-soft">
          Designs live in code (<code>src/emails/</code>). For the awkward cases — five tickets, a missing artwork, a name that runs long — run <code>npm run email:dev</code>, which serves every scenario in <code>src/emails/previews/</code>. docs/email-system.md explains the rest.
        </p>
      </div>
    </AdminShell>
  );
}
