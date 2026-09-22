import 'server-only';

import type { Db, Row } from '@/lib/db/types';
import { addDays, formatDate } from '@/lib/staff/time';
import { withEmailDetails } from './emails';
import { notify } from './notifications';
import { listRequirementsFor } from './requirements';

/**
 * The one thing about employee documents that has to happen on a clock.
 *
 * Everything else in the requirements system is computed at read time —
 * a certificate whose expiry has passed reads as expired the moment anyone
 * looks, with no job to keep it honest. But nobody looks at a bar card
 * thirty days before it lapses, which is exactly when telling them is
 * useful. So one pass a day says so, once.
 *
 * "Once" is enforced against `staff_notifications`: a notification of this
 * kind already pointing at this requirement, raised since the last renewal,
 * means it has been said. No new column, and a replayed cron is harmless.
 */

/** How far ahead to warn, and how long a warning counts as already given. */
export const EXPIRY_WARNING_DAYS = 30;
const REPEAT_AFTER_DAYS = 25;

export interface ExpirySweep {
  checked: number;
  told: number;
}

export async function sweepExpiringDocuments(db: Db, employeeIds: string[], today = new Date().toISOString().slice(0, 10)): Promise<ExpirySweep> {
  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const since = addDays(today, -REPEAT_AFTER_DAYS);
  let checked = 0;
  let told = 0;

  for (const employeeId of employeeIds) {
    const items = await listRequirementsFor(db, employeeId, { today });
    for (const item of items) {
      if (!item.id || !item.expiresOn) continue;
      // Already lapsed is not a warning; the dashboard has been saying so.
      if (item.expiresOn <= today || item.expiresOn > horizon) continue;
      if (item.state !== 'expiring') continue;
      checked += 1;

      const said = await db.list<Row>('staff_notifications', { where: { employee_id: employeeId, kind: 'document_expiring', entity_id: item.id } });
      if (said.some((row) => String(row.created_at ?? '').slice(0, 10) >= since)) continue;

      await notify(
        withEmailDetails(
          {
            employeeIds: [employeeId],
            kind: 'document_expiring',
            title: `${item.type.title} expires ${formatDate(item.expiresOn, 'short')}`,
            body: 'Upload the renewed one so you stay cleared to work.',
            href: '/staff/documents',
            entityType: 'employee_requirement',
            entityId: item.id,
            email: { subject: 'Document expiring', intro: 'Upload the renewed one before it expires so you stay cleared to work.', cta: 'Upload the new one' },
          },
          {
            headline: `Your ${item.type.title.toLowerCase()} expires soon.`,
            details: [
              { label: 'Document', value: item.type.title },
              { label: 'Expires', value: formatDate(item.expiresOn) },
              ...(item.credentialNumber ? [{ label: 'Number', value: item.credentialNumber }] : []),
            ],
          },
        ),
      );
      told += 1;
    }
  }

  return { checked, told };
}
