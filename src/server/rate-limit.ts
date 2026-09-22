import 'server-only';

import { headers } from 'next/headers';

/**
 * A naive in-process limit on how often one visitor may submit a public form.
 *
 * Adequate for a restaurant website on a warm instance, and it is the third
 * line of defence rather than the first: every form also has a honeypot and
 * full server-side validation. A serverless instance that has just cold-started
 * has an empty map, which is the honest limitation of doing this in memory —
 * the alternative is a database round trip on every keystroke-free submit, and
 * spam here is a nuisance, not a cost.
 *
 * Shared by every public form so the window and the message are the same
 * everywhere, rather than a copy per action that drifts.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

/** The visitor, as well as an edge proxy can tell us. Never stored. */
export async function requestFingerprint(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'local'
  );
}

export function rateLimited(key: string, max = MAX_PER_WINDOW): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 500) {
    for (const [existing, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(existing);
    }
  }
  return hits.length > max;
}

/** One sentence, and it offers a way through rather than only refusing. */
export const RATE_LIMIT_MESSAGE =
  'We have already had a few messages from you. Give us a call instead so somebody can help right away.';

/** Test seam: forget every window. */
export function __resetRateLimits(): void {
  recent.clear();
}
