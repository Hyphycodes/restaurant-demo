import 'server-only';

import {
  isTalentDiscipline,
  TALENT_STATUSES,
  type TalentDiscipline,
  type TalentStatus,
  type TalentSubmission,
} from '@/content/talent';
import type { Db, Row } from '@/lib/db/types';



function statusOf(value: unknown): TalentStatus {
  const candidate = String(value ?? 'new') as TalentStatus;
  return TALENT_STATUSES.includes(candidate) ? candidate : 'new';
}

function disciplineOf(value: unknown): TalentDiscipline {
  const candidate = String(value ?? 'other');
  return isTalentDiscipline(candidate) ? candidate : 'other';
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

export function talentFromRow(row: Row): TalentSubmission {
  return {
    id: String(row.id),
    reference: String(row.reference ?? ''),
    name: String(row.name ?? ''),
    email: (row.email as string | null) || null,
    phone: (row.phone as string | null) || null,
    discipline: disciplineOf(row.discipline),
    pitch: String(row.pitch ?? ''),
    links: stringList(row.links),
    mediaPaths: stringList(row.media_paths),
    idea: (row.idea as string | null) || null,
    notes: (row.notes as string | null) || null,
    locationId: (row.location_id as string | null) ?? null,
    status: statusOf(row.status),
    staffNotes: (row.staff_notes as string | null) || null,
    contractorId: (row.contractor_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

export interface TalentFilter {
  /** A status, or 'open' for everything that is not archived. */
  status?: string;
  discipline?: string;
  /** Matches name, what they do, their links, their contact details. */
  query?: string;
}

export async function listTalent(db: Db, filter: TalentFilter = {}): Promise<TalentSubmission[]> {
  const rows = await db.list<Row>('talent_submissions', {
    orderBy: 'created_at',
    desc: true,
    limit: 500,
  });
  const query = filter.query?.trim().toLowerCase() ?? '';

  return rows
    .map(talentFromRow)
    .filter((entry) => {
      if (filter.status === 'open' && entry.status === 'archived') return false;
      if (filter.status && filter.status !== 'open' && entry.status !== filter.status) return false;
      if (filter.discipline && entry.discipline !== filter.discipline) return false;
      if (!query) return true;
      return [entry.name, entry.pitch, entry.email, entry.phone, entry.reference, ...entry.links]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTalent(db: Db, id: string): Promise<TalentSubmission | null> {
  const row = await db.get<Row>('talent_submissions', id);
  return row ? talentFromRow(row) : null;
}

export async function countNewTalent(db: Db): Promise<number> {
  const rows = await db.list<Row>('talent_submissions', { where: { status: 'new' }, limit: 200 });
  return rows.length;
}
