'use server';

import { z } from 'zod';
import { EMAIL_SWITCHES, EMAIL_TEMPLATES, isEmailSwitchId, isTemplateId, templateInfo } from '@/emails/registry';
import { isEmailAddress } from '@/server/email/config';
import { emailService } from '@/server/email/service';
import { getStaff, staffCan } from '@/server/auth';
import { setEmailSwitch as writeEmailSwitch } from '@/server/email/settings';
import { done, run, type ActionState } from './shared';

/**
 * The three things a manager can do from Emails.
 *
 *   setEmailSwitch   turn one of the optional emails on or off. Only the
 *                    ids in EMAIL_SWITCHES exist; a ticket or a sign-in
 *                    link has no switch to reach.
 *   sendTestEmail    one template, one real event, one typed address, marked
 *                    TEST. Needs only the mailer.
 *   sendEventUpdate  one change, to the ticket holders of ONE event, after
 *                    an explicit confirmation. Guest audience, so the
 *                    EMAIL_DELIVERY_ENABLED switch applies.
 *
 * There is deliberately no "email everyone" and no free-form recipient
 * list: the event's paid orders are the only audience this can reach.
 */

const testSchema = z.object({
  template: z.string().refine(isTemplateId, 'Pick an email.'),
  variant: z.string().max(40).optional().or(z.literal('')),
  event: z.string().max(200).optional().or(z.literal('')),
  to: z.string().trim().max(254),
});

export async function sendTestEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) return { ok: false, message: 'Only a manager or the owner can send test emails.' };
  const parsed = testSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const { template, variant, event, to } = parsed.data;
  if (!isEmailAddress(to)) return { ok: false, message: 'Enter the email address the test should go to.' };
  const info = templateInfo(template)!;
  if (info.needsEvent && !event) return { ok: false, message: 'Pick an event for this email.' };

  const result = await emailService.sendTest({ templateId: template, variant: variant || null, eventId: event || null, to });
  if (!result.ok) return { ok: false, message: `Not sent: ${result.reason ?? 'unknown reason'}` };
  return { ok: true, message: `Test ${info.name.toLowerCase()} sent to ${to}. Subject starts with [TEST].` };
}

const updateSchema = z.object({
  event: z.string().min(1, 'Pick an event.').max(200),
  kind: z.enum(['time_change', 'date_change', 'venue_change', 'info', 'postponed']),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  confirm: z.literal('yes', { errorMap: () => ({ message: 'Tick the box to confirm this goes to every ticket holder.' }) }),
});

export async function sendEventUpdate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) return { ok: false, message: 'Only a manager or the owner can email ticket holders.' };
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const { event, kind, message } = parsed.data;
  if (kind === 'info' && !message) return { ok: false, message: 'An information update needs the update itself — write what changed.' };

  const outcome = await emailService.sendEventUpdate(event, { kind, message: message || null });
  const total = outcome.sent + outcome.skipped + outcome.failed;
  if (total === 0) return { ok: false, message: 'Nobody holds a paid ticket for that event, so there was nobody to email.' };
  const parts = [`${outcome.sent} sent`];
  if (outcome.skipped) parts.push(`${outcome.skipped} skipped`);
  if (outcome.failed) parts.push(`${outcome.failed} failed`);
  const hint = outcome.skipped && !outcome.sent ? ' Skipped means guest delivery is switched off or the mailer is not configured — see the status at the top of this screen.' : '';
  return { ok: outcome.sent > 0 || outcome.failed === 0, message: `${parts.join(', ')} of ${total} ticket holders.${hint}` };
}

export async function listTemplates() {
  return EMAIL_TEMPLATES;
}

const switchSchema = z.object({
  id: z.string().refine(isEmailSwitchId, 'Unknown email.'),
  on: z.enum(['true', 'false']),
});

/**
 * Turn one optional email on or off.
 *
 * Writing goes through the same harness as every other admin change, so the
 * capability is checked before a database handle exists and the row-level
 * policy on `email_settings` applies on top of it. Nothing is revalidated:
 * the switch is read by the cron and the service at send time, and the one
 * screen that shows it re-renders itself.
 */
export async function setEmailSwitch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = switchSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Could not change that email.' };
    const entry = EMAIL_SWITCHES.find((item) => item.id === parsed.data.id)!;
    const on = parsed.data.on === 'true';
    // `updated_by` references auth.users, so only a real Supabase identity
    // may fill it — the local and open-admin identities are not in that table.
    await writeEmailSwitch(db, entry.id, on, staff.source === 'supabase' ? staff.id : null);
    return done(on ? `${entry.label} is on. ${entry.detail}` : `${entry.label} is off. Nothing will be sent for it.`);
  });
}
