/**
 * Display labels shared by the admin's server and client components.
 *
 * They live here, outside `src/server/`, precisely because both sides need them.
 * The server modules re-export from this file, so there is one wording for
 * "Sold out today" and it cannot say something different in the list than it does
 * in the editor — and importing it into a client component does not drag a
 * `server-only` module into the browser bundle.
 */

export type PriceMode = 'fixed' | 'ask-server' | 'market' | 'hidden';
export type Availability = 'available' | 'unavailable' | 'hidden';

export const PRICE_MODE_LABEL: Record<PriceMode, string> = {
  fixed: 'A set price',
  'ask-server': 'Ask your server',
  market: 'Market price',
  hidden: 'No price shown',
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'On the menu',
  unavailable: 'Sold out today',
  hidden: 'Hidden from guests',
};

/** What each choice actually does, in the guest's terms. */
export const AVAILABILITY_HELP: Record<Availability, string> = {
  available: 'Guests see it as normal.',
  unavailable: 'Guests still see it, greyed out, labelled “Currently unavailable”.',
  hidden: 'Guests do not see it at all. It stays here so you can bring it back.',
};

/**
 * The whole tag vocabulary. Kept small on purpose: a controlled list people
 * actually use beats a free-text field nobody fills in consistently.
 */
export const MEDIA_TAGS = ['Food', 'Drinks', 'Events', 'Room', 'Exterior', 'Team', 'Brand'] as const;
export type MediaTag = (typeof MEDIA_TAGS)[number];
