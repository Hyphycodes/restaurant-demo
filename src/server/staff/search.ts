import 'server-only';

import type { Db } from '@/lib/db/types';
import { listContractors } from './contractors';
import { listEmployees } from './employees';
import { listEventsBetween } from './events';
import { listEventAssignments } from './staffing';

/**
 * Search, and what it is allowed to find.
 *
 * The rule that matters: a search result is a read, and it obeys the same
 * capabilities every other read does. Hiding a row from a list and then
 * handing it back the moment somebody types a name is the most common way
 * an access-control system leaks, so the scope is an argument here rather
 * than an assumption about who called.
 *
 * `scope: 'team'` is a manager: people with their contact details,
 * contractors, and who is working an upcoming night.
 * `scope: 'roster'` is an employee: coworkers by name and position only —
 * no phone number, no email, no contractors, no bookings.
 */
export interface SearchHit {
  kind: 'employee' | 'contractor' | 'event';
  id: string;
  title: string;
  detail: string;
  href: string;
}

export type SearchScope = 'team' | 'roster';

export async function staffSearch(db: Db, query: string, scope: SearchScope = 'team', now = new Date()): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const manager = scope === 'team';

  const [employees, contractors, events] = await Promise.all([
    listEmployees(db, { query: needle, includeInactive: manager }),
    manager ? listContractors(db, { query: needle, includeInactive: true }) : Promise.resolve([]),
    listEventsBetween(db, now.toISOString(), new Date(now.getTime() + 60 * 86_400_000).toISOString()),
  ]);

  const hits: SearchHit[] = employees.slice(0, 8).map((employee) => ({
    kind: 'employee',
    id: employee.id,
    title: manager ? employee.fullName || employee.displayName : employee.displayName,
    // An employee's search gets a name and a job. Contact details are a
    // manager's to hand out.
    detail: manager
      ? [employee.positionIds.join(', '), employee.phone, employee.email].filter(Boolean).join(' · ')
      : employee.positionIds.join(', '),
    href: manager ? `/staff/team/${employee.id}` : '/staff',
  }));

  for (const contractor of contractors.slice(0, 5)) {
    hits.push({
      kind: 'contractor',
      id: contractor.id,
      title: contractor.name,
      detail: [contractor.serviceType, contractor.phone, contractor.email].filter(Boolean).join(' · '),
      href: `/staff/contractors/${contractor.id}`,
    });
  }

  for (const event of events) {
    const matchesTitle = event.title.toLowerCase().includes(needle);
    // Who is working a night is a manager's read; an employee matches on the
    // event's own name and nothing else.
    const assignments = matchesTitle || !manager ? [] : await listEventAssignments(db, event.id);
    const named = assignments.filter((assignment) => assignment.employeeName.toLowerCase().includes(needle));
    if (matchesTitle || named.length > 0) {
      hits.push({
        kind: 'event',
        id: event.id,
        title: event.title,
        detail: named.length > 0 ? `Staffed by ${named.map((assignment) => assignment.employeeName).join(', ')}` : event.startsAt.slice(0, 10),
        href: `/staff/events/${encodeURIComponent(event.id)}`,
      });
    }
  }
  return hits;
}
