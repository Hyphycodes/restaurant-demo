import 'server-only';

import { cache } from 'react';
import {
  staticJobOpenings,
  type ApplicationStatus,
  type EmploymentType,
  type JobApplication,
  type JobOpening,
} from '@/content/careers';
import { getReadDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';

/**
 * Job openings and the applications that arrive against them.
 *
 * Reads only. Every write is a server action, so the capability check and the
 * revalidation happen in exactly one place (`src/server/actions/hiring.ts`).
 *
 * The public list resolves the same way every other piece of content does:
 * database first, typed module as the fallback, and it can never throw. The
 * typed fallback is nine inactive roles, so a site with no database shows no
 * openings rather than nine it cannot fill — which is the honest answer.
 */

const EMPLOYMENT: EmploymentType[] = ['full_time', 'part_time', 'either', 'seasonal'];

function employmentOf(value: unknown): EmploymentType {
  const candidate = String(value ?? 'either') as EmploymentType;
  return EMPLOYMENT.includes(candidate) ? candidate : 'either';
}

export function openingFromRow(row: Row): JobOpening {
  return {
    id: String(row.id),
    locationId: (row.location_id as string | null) ?? null,
    title: String(row.title ?? ''),
    summary: (row.summary as string | null) || null,
    employmentType: employmentOf(row.employment_type),
    active: row.active === true,
    sort: Number(row.sort ?? 0),
    archivedAt: (row.archived_at as string | null) ?? null,
  };
}

function bySort(a: JobOpening, b: JobOpening): number {
  return a.sort - b.sort || a.title.localeCompare(b.title);
}

/** What the website shows: switched on, not archived, in the chosen order. */
export const getPublicOpenings = cache(async (): Promise<JobOpening[]> => {
  const db = getReadDb();
  const fallback = staticJobOpenings.filter((opening) => opening.active);
  if (!db) return fallback;
  try {
    const rows = await db.list<Row>('job_openings', { orderBy: 'sort' });
    if (rows.length === 0) return fallback;
    return rows
      .map(openingFromRow)
      .filter((opening) => opening.active && !opening.archivedAt)
      .sort(bySort);
  } catch (error) {
    console.error('[hiring] openings unavailable, serving static fallback:', error);
    return fallback;
  }
});

/** Admin read: inactive and archived included, because that is what is edited. */
export async function getEditableOpenings(db: Db): Promise<JobOpening[]> {
  const rows = await db.list<Row>('job_openings', { orderBy: 'sort' });
  return rows.map(openingFromRow).sort(bySort);
}

/* ------------------------------------------------------------ applications */

const STATUSES: ApplicationStatus[] = [
  'new',
  'reviewing',
  'contacted',
  'interview',
  'hired',
  'passed',
  'archived',
];

function statusOf(value: unknown): ApplicationStatus {
  const candidate = String(value ?? 'new') as ApplicationStatus;
  return STATUSES.includes(candidate) ? candidate : 'new';
}

export function applicationFromRow(row: Row): JobApplication {
  return {
    id: String(row.id),
    reference: String(row.reference ?? ''),
    openingId: (row.opening_id as string | null) ?? null,
    position: String(row.position ?? ''),
    locationId: (row.location_id as string | null) ?? null,
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: (row.phone as string | null) || null,
    availability: (row.availability as string | null) || null,
    experience: (row.experience as string | null) || null,
    resumePath: (row.resume_path as string | null) || null,
    resumeName: (row.resume_name as string | null) || null,
    notes: (row.notes as string | null) || null,
    status: statusOf(row.status),
    staffNotes: (row.staff_notes as string | null) || null,
    createdAt: String(row.created_at ?? ''),
  };
}

export interface ApplicantFilter {
  /** A status, or 'open' for everything still in play. */
  status?: string;
  openingId?: string;
  /** Matches name, email, phone, position or reference. */
  query?: string;
}

/** Everything still in play — the default view, because a no is filed, not read. */
const SETTLED: ApplicationStatus[] = ['hired', 'passed', 'archived'];

export async function listApplications(
  db: Db,
  filter: ApplicantFilter = {},
): Promise<JobApplication[]> {
  const rows = await db.list<Row>('job_applications', {
    orderBy: 'created_at',
    desc: true,
    limit: 500,
  });
  const query = filter.query?.trim().toLowerCase() ?? '';

  return rows
    .map(applicationFromRow)
    .filter((entry) => {
      if (filter.status === 'open' && SETTLED.includes(entry.status)) return false;
      if (filter.status && filter.status !== 'open' && entry.status !== filter.status) return false;
      if (filter.openingId && entry.openingId !== filter.openingId) return false;
      if (!query) return true;
      return [entry.name, entry.email, entry.phone, entry.position, entry.reference]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getApplication(db: Db, id: string): Promise<JobApplication | null> {
  const row = await db.get<Row>('job_applications', id);
  return row ? applicationFromRow(row) : null;
}

/** How many have not been looked at. Used by the admin home and the nav count. */
export async function countNewApplications(db: Db): Promise<number> {
  const rows = await db.list<Row>('job_applications', { where: { status: 'new' }, limit: 200 });
  return rows.length;
}
