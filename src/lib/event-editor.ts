import type { Row } from '@/lib/db/types';

/**
 * Pure helpers the event editor shares between the server actions, the page
 * and the client — kept out of the actions module, which may only export
 * async functions.
 */

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'event'
  );
}

/** What stops an event going on sale, in plain words, keyed by field. */
export function publishProblems(row: Row, tiers: Row[]): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!row.title || !String(row.title).trim()) problems.title = 'Give the event a name before it goes on the website.';
  if (!row.starts_at) problems.date = 'This event needs a date before it can go on sale.';
  if (!row.slug) problems.slug = 'The event needs a web address.';
  if (row.ticketing_enabled) {
    const live = tiers.filter((tier) => tier.is_active !== false);
    if (live.length === 0) problems.tiers = 'Add at least one ticket type, or turn ticket sales off.';
    if (row.capacity && live.some((tier) => Number(tier.capacity ?? 0) > Number(row.capacity))) {
      problems.capacity = 'A ticket type holds more seats than the event does.';
    }
  }
  return problems;
}
