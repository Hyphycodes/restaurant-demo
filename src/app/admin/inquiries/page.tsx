import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, EmptyState, SummaryStrip } from '@/components/admin/ui';
import type { InquiryRecord } from '@/content/types';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getStaff } from '@/server/auth';
import { InquiryRow } from './InquiryRow';

export const dynamic = 'force-dynamic';

/**
 * Enquiries.
 *
 * Not in the main navigation, deliberately: six destinations is the ceiling, and
 * this is reached from the dashboard. It is a shared inbox with a status and a
 * note, not a CRM — and there is no delete, because an enquiry is a business
 * record.
 */
export default async function InquiriesPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const db = getReadDb();
  const rows = db ? await db.list<Row>('inquiries', { orderBy: 'created_at', desc: true, limit: 100 }) : [];

  const inquiries: InquiryRecord[] = rows.map((row) => ({
    id: String(row.id),
    type: row.type as InquiryRecord['type'],
    name: String(row.name),
    email: String(row.email),
    phone: (row.phone as string | null) ?? null,
    payload: (row.payload as InquiryRecord['payload']) ?? {},
    status: (row.status as InquiryRecord['status']) ?? 'new',
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  }));

  const waiting = inquiries.filter((entry) => entry.status === 'new');

  return (
    <AdminShell
      staff={staff}
      local={isLocalDb()}
      title="Enquiries"
      description="Catering, private events and job applications sent through the website."
    >
      {!db ? (
        <EmptyState>
          The inbox is not connected. Forms ask guests to call instead of claiming their message was saved.
        </EmptyState>
      ) : inquiries.length === 0 ? (
        <EmptyState>No enquiries yet.</EmptyState>
      ) : (
        <>
          {waiting.length > 0 ? (
            <div className="mb-5">
              <SummaryStrip tone="warning">
                <strong className="font-semibold">
                  {waiting.length} {waiting.length === 1 ? 'enquiry is' : 'enquiries are'} waiting
                  for a reply
                </strong>{' '}
                — they are open below, newest first.
              </SummaryStrip>
            </div>
          ) : null}
          <Card>
            <ul>
              {inquiries.map((inquiry) => (
                <InquiryRow key={inquiry.id} inquiry={inquiry} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
