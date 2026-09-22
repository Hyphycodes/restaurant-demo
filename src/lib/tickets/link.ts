import { absoluteUrl } from '@/lib/site-url';

/**
 * One ticket, one link.
 *
 * The QR encodes this URL rather than the bare token, because a guest who
 * points their camera at it out of habit should land on their own ticket
 * instead of a meaningless string. It also makes a single ticket forwardable:
 * four friends who arrive separately each get their own link, while the order
 * page still shows all four to whoever bought them.
 *
 * JSX-free and crypto-free on purpose: the door scanner runs `tokenFromScan` in
 * the browser, offline, against a cached manifest. The shape check lives here
 * rather than beside the signing code for the same reason — importing that
 * module would drag `node:crypto` into a client bundle, which fails the build.
 * Verifying the signature is still the server's job, and the door's.
 */

/** Shaped like one of ours. Says nothing about whether the signature holds. */
export function isTicketToken(input: string): boolean {
  return /^t1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.trim());
}

export function ticketPath(token: string): string {
  return `/t/${encodeURIComponent(token)}`;
}

export function ticketLink(token: string): string {
  return absoluteUrl(ticketPath(token));
}

/**
 * The signed token inside whatever the camera read.
 *
 * Accepts the bare token and the full URL, in any form a QR reader might hand
 * back — with or without the scheme, with a trailing slash, with query junk
 * appended by a scanner app. Anything else is not ours and returns null so the
 * caller can try it as a hand-typed code instead.
 */
export function tokenFromScan(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (isTicketToken(value)) return value;

  // A URL: take the last path segment, which is where ticketPath puts it.
  const withoutQuery = value.split(/[?#]/)[0] ?? '';
  const segments = withoutQuery.split('/').filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const candidate = decodeURIComponent(segments[index] ?? '');
    if (isTicketToken(candidate)) return candidate;
  }
  return null;
}
