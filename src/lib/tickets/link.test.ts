import { describe, expect, it } from 'vitest';
import { ticketPath, tokenFromScan } from './link';

/**
 * What a camera hands back is not always what was encoded: scanner apps strip
 * schemes, append their own query strings, and sometimes return the bare
 * payload. Every one of those must resolve to the same ticket.
 */

const TOKEN = 't1.eyJ0aWQiOiJhYmMiLCJlaWQiOiJldnQiLCJ2IjoxfQ.c2lnbmF0dXJl';

describe('tokenFromScan', () => {
  it('takes a bare token', () => {
    expect(tokenFromScan(TOKEN)).toBe(TOKEN);
    expect(tokenFromScan(`  ${TOKEN}  `)).toBe(TOKEN);
  });

  it('takes the full ticket URL the QR actually encodes', () => {
    expect(tokenFromScan(`https://example.invalid${ticketPath(TOKEN)}`)).toBe(TOKEN);
    expect(tokenFromScan(`http://localhost:3000${ticketPath(TOKEN)}`)).toBe(TOKEN);
  });

  it('survives what scanner apps do to a URL', () => {
    expect(tokenFromScan(`www.casaaurelia.example/t/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromScan(`https://casa-aurelia.example/t/${TOKEN}?utm_source=scanner`)).toBe(TOKEN);
    expect(tokenFromScan(`https://casa-aurelia.example/t/${TOKEN}#top`)).toBe(TOKEN);
  });

  it('refuses anything that is not one of ours', () => {
    expect(tokenFromScan('')).toBeNull();
    expect(tokenFromScan('https://example.com/loyalty/12345')).toBeNull();
    expect(tokenFromScan('ABCD-EFGH')).toBeNull();
    // A tampered signature is still shaped like a token; the door's signature
    // check is what rejects it, not this.
    expect(tokenFromScan('o1.abc.def')).toBeNull();
  });
});
