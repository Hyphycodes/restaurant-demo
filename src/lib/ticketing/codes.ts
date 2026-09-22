/**
 * Human-safe codes.
 *
 * Crockford base32 with no I, L, O or U, so a code read aloud at a door or
 * typed off a photograph cannot be misheard. The database mints its own with
 * the same alphabet (`crockford_random`); these helpers exist for the parts of
 * the system that run in TypeScript — validation, normalisation and tests.
 */

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCrockford(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += CROCKFORD[byte % 32];
  return out;
}

/** `H7K4-M2Q9` */
export function formatTicketCode(raw: string): string {
  const clean = normalizeCode(raw);
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

/**
 * What a person typed → what is stored. Uppercases, drops separators and
 * spaces, and forgives the four letters the alphabet leaves out.
 */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

export function isTicketCode(input: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(normalizeCode(input));
}

export function isOrderNumber(input: string): boolean {
  return /^CNS-[0-9A-HJKMNP-TV-Z]{5}$/.test(input.trim().toUpperCase());
}
