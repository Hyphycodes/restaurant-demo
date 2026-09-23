import 'server-only';

import type { InquiryRecord } from '@/content/types';
import type { Db, Row } from '@/lib/db/types';
import { inquiryFromRow } from '@/lib/inquiry-pipeline';

/**
 * Enquiries, read for the admin pipeline. Both screens go through here so a
 * legacy 'in-progress' row is normalised to Contacted in exactly one place.
 */

/** Enough for a busy year of private events; the board is not an archive. */
const BOARD_LIMIT = 500;

export async function listInquiries(db: Db): Promise<InquiryRecord[]> {
  const rows = await db.list<Row>('inquiries', { orderBy: 'created_at', desc: true, limit: BOARD_LIMIT });
  return rows.map(inquiryFromRow);
}

export async function getInquiry(db: Db, id: string): Promise<InquiryRecord | null> {
  const row = await db.get<Row>('inquiries', id);
  return row ? inquiryFromRow(row) : null;
}
