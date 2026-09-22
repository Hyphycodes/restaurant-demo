import { NextResponse, type NextRequest } from 'next/server';
import { getTicketingClient } from '@/server/ticketing/db';
import { emailService } from '@/server/email/service';
import { emailSwitches } from '@/server/email/settings';
import type { EmailSwitchId } from '@/emails/registry';
import { opsElevatedDb } from '@/server/staff/db';
import { listEmployees } from '@/server/staff/employees';
import { sweepExpiringDocuments } from '@/server/staff/expiry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The lifecycle emails, hourly.
 *
 * One route, one pass per stage, because the alternative — scheduling a send
 * per order at purchase time — means a cancelled event still emails everybody
 * "see you tonight". Reading the database every hour is how a cancellation
 * silences the rest of the sequence for free.
 *
 * Which stages run is the owner's, not a developer's: each one has a switch
 * on Emails in the admin, and this route reads them at the top of every
 * pass. The day-before reminder ships on; "tonight" and "thanks for coming"
 * ship off, because an unasked-for email costs more goodwill than it earns
 * and the sender reputation of a young domain is not worth spending on one.
 * A switch that cannot be read counts as on, so a settings outage delays
 * nobody's reminder.
 *
 * The same route also runs the ONE staff job that needs a clock: telling an
 * employee their certificate expires in thirty days. Everything else about
 * requirements is computed when somebody looks; nobody looks at a bar card a
 * month early. It is skipped entirely until the staff tables exist, so this
 * route behaves exactly as before on a database without migration 0022.
 */

interface Stage {
  /** Matches the email_log type, which is also how a repeat is prevented. */
  id: 'reminder' | 'tonight' | 'thanks';
  /** The switch in `email_settings` that decides whether this pass runs at all. */
  switchId: EmailSwitchId;
  /** Hours from now: events starting inside this window are in scope. Negative = already happened. */
  window: [number, number];
  label: string;
}

const STAGES: Stage[] = [
  { id: 'reminder', switchId: 'event_reminder', window: [23, 25], label: 'the day before' },
  { id: 'tonight', switchId: 'event_reminder_tonight', window: [3, 5], label: 'a few hours before doors' },
  { id: 'thanks', switchId: 'thanks_for_coming', window: [-36, -12], label: 'the morning after' },
];

const MAX_PER_RUN = 200;

/**
 * Warns about certificates lapsing inside thirty days. Never throws: a staff
 * job must not fail the ticket reminders that share this route, and on a
 * database without the employee tables it simply finds nothing.
 */
async function expiringDocuments(): Promise<number> {
  try {
    const db = opsElevatedDb();
    if (!db) return 0;
    const employees = await listEmployees(db);
    if (employees.length === 0) return 0;
    const { told } = await sweepExpiringDocuments(db, employees.map((employee) => employee.id));
    return told;
  } catch (error) {
    console.warn(`[cron] document expiry sweep skipped: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const client = getTicketingClient();
  if (!client) return NextResponse.json({ ok: false, message: 'Ticketing is not configured.' }, { status: 503 });

  const results: Record<string, number> = {};
  const switches = await emailSwitches();

  for (const stage of STAGES) {
    if (!switches[stage.switchId]) continue;

    const from = new Date(Date.now() + stage.window[0] * 3_600_000).toISOString();
    const to = new Date(Date.now() + stage.window[1] * 3_600_000).toISOString();
    const { data: events } = await client
      .from('event_occurrences')
      .select('id')
      .is('series_slug', null)
      .eq('ticketing_enabled', true)
      .gte('starts_at', from)
      .lte('starts_at', to);
    const eventIds = (events ?? []).map((row) => String(row.id));
    if (eventIds.length === 0) {
      results[stage.id] = 0;
      continue;
    }

    const { data: orders } = await client
      .from('orders')
      .select('id')
      .in('event_id', eventIds)
      .in('status', ['paid', 'partially_refunded'])
      .not('customer_email', 'is', null)
      .limit(MAX_PER_RUN);

    let sent = 0;
    for (const order of orders ?? []) {
      // The day-before stage keeps its own column, which predates this loop and
      // is claimed atomically — two overlapping runs cannot both send it.
      if (stage.id === 'reminder') {
        const claimed = await client
          .from('orders')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', order.id)
          .is('reminder_sent_at', null)
          .select('id');
        if (!claimed.data?.length) continue;
      } else {
        const { data: already } = await client
          .from('email_log')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', stage.id)
          .eq('status', 'sent')
          .limit(1);
        if (already?.length) continue;
      }

      // Nothing to remind someone about if every ticket is already used or void.
      if (stage.id !== 'thanks') {
        const { data: unused } = await client.from('tickets').select('id').eq('order_id', order.id).eq('status', 'valid').limit(1);
        if (!unused?.length) continue;
      }

      const result =
        stage.id === 'thanks'
          ? await emailService.sendThanksForComing(String(order.id))
          : await emailService.sendEventReminder(String(order.id), stage.id === 'tonight' ? 'tonight' : 'tomorrow');
      if (result.ok) sent += 1;
    }
    results[stage.id] = sent;
  }

  results.documents_expiring = await expiringDocuments();

  return NextResponse.json({ ok: true, ...results });
}
