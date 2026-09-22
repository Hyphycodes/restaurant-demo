import { describe, expect, it } from 'vitest';
import { signOrderToken, signTicketToken, verifyOrderToken, verifyTicketToken } from './tokens';

const KEY = 'a-test-secret-that-is-long-enough-for-hmac-1234';

describe('order tokens', () => {
  it('round-trips and expires after 30 days', () => {
    const now = new Date('2026-09-18T12:00:00Z');
    const token = signOrderToken('order-1', now, KEY);
    expect(verifyOrderToken(token, now, KEY)).toBe('order-1');
    expect(verifyOrderToken(token, new Date('2026-10-19T12:00:00Z'), KEY)).toBeNull();
  });
  it('rejects tampering and the wrong key', () => {
    const token = signOrderToken('order-1', new Date(), KEY);
    const [prefix, payload, sig] = token.split('.');
    const forged = `${prefix}.${Buffer.from(JSON.stringify({ oid: 'order-2', exp: 9999999999 })).toString('base64url')}.${sig}`;
    expect(verifyOrderToken(forged, new Date(), KEY)).toBeNull();
    expect(verifyOrderToken(`${prefix}.${payload}.${sig}x`, new Date(), KEY)).toBeNull();
    expect(verifyOrderToken(token, new Date(), `${KEY}-other`)).toBeNull();
  });
});

describe('ticket tokens', () => {
  it('round-trips without a database', () => {
    const token = signTicketToken('ticket-1', 'event-1', KEY);
    expect(token.startsWith('t1.')).toBe(true);
    expect(verifyTicketToken(token, KEY)).toEqual({ tid: 'ticket-1', eid: 'event-1', v: 1 });
  });
  it('fails instantly on a tampered payload', () => {
    const token = signTicketToken('ticket-1', 'event-1', KEY);
    const [prefix, , sig] = token.split('.');
    const forged = `${prefix}.${Buffer.from(JSON.stringify({ tid: 'ticket-1', eid: 'event-2', v: 1 })).toString('base64url')}.${sig}`;
    expect(verifyTicketToken(forged, KEY)).toBeNull();
    expect(verifyTicketToken('garbage', KEY)).toBeNull();
  });
});

/**
 * What a QR is worth if somebody photographs it, and what it gives away.
 * Both matter more than they look: a ticket token is a bearer credential that
 * spends the night on strangers' screens.
 */
describe('ticket tokens as credentials', () => {
  const KEY = 'test-secret-that-is-long-enough-000000';

  it('carries no personal data at all', () => {
    const token = signTicketToken('ticket-1', 'tickeri:abc', KEY);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
    // Two opaque ids and a version. Nothing that identifies a person, and no
    // price — the database resolves all of that afterwards.
    expect(Object.keys(payload).sort()).toEqual(['eid', 'tid', 'v']);
    expect(JSON.stringify(payload)).not.toMatch(/@|name|email|price|cents/i);
  });

  it('gives every ticket in an order a different token', () => {
    const a = signTicketToken('ticket-1', 'tickeri:abc', KEY);
    const b = signTicketToken('ticket-2', 'tickeri:abc', KEY);
    expect(a).not.toBe(b);
    // …and knowing one tells you nothing about the next: the signatures differ
    // completely, so a guest cannot derive their friend's ticket from their own.
    expect(a.split('.')[2]).not.toBe(b.split('.')[2]);
  });

  it('cannot be re-pointed at another event by editing the payload', () => {
    const token = signTicketToken('ticket-1', 'tickeri:abc', KEY);
    const forged = `t1.${Buffer.from(JSON.stringify({ tid: 'ticket-1', eid: 'tickeri:other', v: 1 })).toString('base64url')}.${token.split('.')[2]}`;
    expect(verifyTicketToken(forged, KEY)).toBeNull();
  });

  it('refuses a token signed with a different secret', () => {
    const token = signTicketToken('ticket-1', 'tickeri:abc', 'another-secret-that-is-long-enough-0');
    expect(verifyTicketToken(token, KEY)).toBeNull();
  });

  it('refuses an order token used as a ticket token', () => {
    expect(verifyTicketToken(signOrderToken('order-1', new Date(), KEY), KEY)).toBeNull();
  });
});
