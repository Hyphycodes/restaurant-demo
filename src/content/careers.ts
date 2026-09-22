import type { Row } from '@/lib/db/types';
import { CHICAGO_LOCATION_ID } from './locations';



export type EmploymentType = 'full_time' | 'part_time' | 'either' | 'seasonal';

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  either: 'Full or part-time',
  seasonal: 'Seasonal',
};

export const EMPLOYMENT_TYPES: EmploymentType[] = ['either', 'full_time', 'part_time', 'seasonal'];

export interface JobOpening {
  id: string;
  locationId: string | null;
  title: string;
  /** One sentence under the title, or null. Never invented. */
  summary: string | null;
  employmentType: EmploymentType;
  active: boolean;
  sort: number;
  archivedAt: string | null;
}

export type ApplicationStatus =
  | 'new'
  | 'reviewing'
  | 'contacted'
  | 'interview'
  | 'hired'
  | 'passed'
  | 'archived';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new',
  'reviewing',
  'contacted',
  'interview',
  'hired',
  'passed',
  'archived',
];

/** Plain words. "Passed" is the kindest honest label for a no. */
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  interview: 'Interview',
  hired: 'Hired',
  passed: 'Passed',
  archived: 'Archived',
};

export interface JobApplication {
  id: string;
  reference: string;
  openingId: string | null;
  position: string;
  locationId: string | null;
  name: string;
  email: string;
  phone: string | null;
  availability: string | null;
  experience: string | null;
  resumePath: string | null;
  resumeName: string | null;
  notes: string | null;
  status: ApplicationStatus;
  staffNotes: string | null;
  createdAt: string;
}

/**
 * What somebody picks when nothing on the list is their job.
 *
 * It is not stored as an opening — it is the absence of one — so it lives here
 * as a constant both the form and the server agree on.
 */
export const OPEN_APPLICATION = 'Something else';

export function employmentLabel(type: EmploymentType): string {
  return EMPLOYMENT_LABEL[type] ?? EMPLOYMENT_LABEL.either;
}


export const staticJobOpenings: JobOpening[] = [
  ['c05a0000-0000-4000-8000-000000000101', 'Server', 'either', 10],
  ['c05a0000-0000-4000-8000-000000000102', 'Bartender', 'either', 20],
  ['c05a0000-0000-4000-8000-000000000103', 'Host', 'part_time', 30],
  ['c05a0000-0000-4000-8000-000000000104', 'Line cook', 'full_time', 40],
  ['c05a0000-0000-4000-8000-000000000105', 'Prep cook', 'either', 50],
  ['c05a0000-0000-4000-8000-000000000106', 'Busser', 'part_time', 60],
  ['c05a0000-0000-4000-8000-000000000107', 'Dishwasher', 'either', 70],
  ['c05a0000-0000-4000-8000-000000000108', 'Door / security', 'part_time', 80],
  ['c05a0000-0000-4000-8000-000000000109', 'Event staff', 'part_time', 90],
].map(([id, title, employmentType, sort]) => ({
  id: String(id),
  locationId: CHICAGO_LOCATION_ID,
  title: String(title),
  summary: null,
  employmentType: employmentType as EmploymentType,
  active: Number(sort) <= 40,
  sort: Number(sort),
  archivedAt: null,
}));

/** The same rows as database rows, for the local database and the SQL seed. */
export const REFERENCE_JOB_OPENINGS: Row[] = staticJobOpenings.map((opening) => ({
  id: opening.id,
  location_id: opening.locationId,
  title: opening.title,
  summary: opening.summary,
  employment_type: opening.employmentType,
  active: opening.active,
  sort: opening.sort,
}));
