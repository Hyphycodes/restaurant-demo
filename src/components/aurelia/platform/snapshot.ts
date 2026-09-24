import 'server-only';

import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getUpcomingEvents } from '@/lib/events';
import { getPublicEvents } from '@/server/content/events';

/**
 * What the operating room shows when it is drawn on the public site.
 *
 * Real where it is cheap to be real: the next event and the enquiries come
 * from the same records the admin reads, so a change in the demo shows up in
 * the portfolio sequence too. The rota and checklist mirror the staff demo.
 */
export interface PlatformSnapshot {
  event: { title: string; when: string; sold: number; capacity: number } | null;
  upcoming: { title: string; when: string; status: string }[];
  inquiries: { name: string; kind: string; guests: number | null; status: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'in-progress': 'Contacted',
  planning: 'Planning',
  booked: 'Booked',
  closed: 'Closed',
};

export async function getPlatformSnapshot(): Promise<PlatformSnapshot> {
  const now = new Date();
  const input = await getPublicEvents();
  const upcoming = getUpcomingEvents(input, now, 6).filter((event) => event.status !== 'cancelled');
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));

  let inquiries: PlatformSnapshot['inquiries'] = [];
  try {
    const rows = (await getReadDb()?.list<Row>('inquiries', { orderBy: 'created_at', desc: true, limit: 4 })) ?? [];
    inquiries = rows.map((row) => {
      const payload = (row.payload as Record<string, unknown> | null) ?? {};
      return {
        name: String(row.name ?? 'Guest'),
        kind: row.type === 'catering' ? 'Catering' : String(payload.eventType ?? 'Private dinner'),
        guests: typeof payload.guests === 'number' ? payload.guests : Number(payload.guests) || null,
        status: STATUS_LABEL[String(row.status)] ?? 'New',
      };
    });
  } catch {
    inquiries = [];
  }

  const first = upcoming[0];
  return {
    event: first
      ? { title: first.title, when: fmt(first.startsAt), sold: 42, capacity: first.ticketing.capacity ?? 60 }
      : null,
    upcoming: upcoming.slice(0, 4).map((event) => ({
      title: event.title,
      when: fmt(event.startsAt),
      status: event.status === 'sold-out' ? 'Sold out' : event.ticketing.enabled ? 'On sale' : 'Free',
    })),
    inquiries,
  };
}
