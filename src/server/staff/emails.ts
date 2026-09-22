import 'server-only';

import { SITE_URL } from '@/lib/site-url';
import type { Row } from '@/lib/db/types';
import { emailService } from '@/server/email/service';
import { opsElevatedDb } from './db';
import { registerNotificationChannel, type NotificationInput, type NotificationKind } from './notifications';



const TEMPLATE_FOR: Partial<Record<NotificationKind, 'staff_welcome' | 'schedule_published' | 'shift_changed' | 'time_off_decision' | 'training_required' | 'document_expiring' | 'event_assignment'>> = {
  welcome: 'staff_welcome',
  schedule_published: 'schedule_published',
  shift_changed: 'shift_changed',
  shift_cancelled: 'shift_changed',
  time_off_decided: 'time_off_decision',
  training_assigned: 'training_required',
  document_expiring: 'document_expiring',
  event_assignment: 'event_assignment',
};

export interface StaffEmailDetails {
  headline?: string;
  details?: { label: string; value: string }[];
  note?: string | null;
}

/** Extra facts a notification can carry for its email, keyed by employee. */
const pendingDetails = new WeakMap<NotificationInput, Map<string, StaffEmailDetails>>();

export function withEmailDetails(input: NotificationInput, details: Map<string, StaffEmailDetails> | StaffEmailDetails): NotificationInput {
  pendingDetails.set(input, details instanceof Map ? details : new Map(input.employeeIds.map((id) => [id, details])));
  return input;
}

registerNotificationChannel({
  async deliver(notification, employeeId) {
    const template = TEMPLATE_FOR[notification.kind];
    if (!template || !notification.email) return;
    const db = opsElevatedDb();
    if (!db) return;
    const employee = await db.get<Row>('employees', employeeId);
    if (!employee || employee.notification_email === false || !employee.email) return;
    const extra = pendingDetails.get(notification)?.get(employeeId) ?? {};
    const href = notification.href ?? '/staff';
    await emailService.sendStaffNotice(template, {
      name: String(employee.preferred_name || employee.first_name || ''),
      email: String(employee.email),
      headline: extra.headline ?? notification.title,
      intro: notification.email.intro,
      details: extra.details ?? [],
      note: extra.note ?? notification.body ?? null,
      actionUrl: href.startsWith('http') ? href : `${SITE_URL}${href}`,
      actionLabel: notification.email.cta,
    });
  },
});

/** Importing this module registers the channel. Called once from the notification entry points. */
export const staffEmailChannelReady = true;
