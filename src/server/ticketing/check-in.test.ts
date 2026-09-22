import { describe, expect, it } from 'vitest';
import { earlierCheckIn } from './scan';

/**
 * The rule that decides what time a guest arrived when two doors both scanned
 * them while offline. It matters because a dispute turns on exactly this: a
 * timestamp that says when somebody walked in.
 */
describe('earlierCheckIn', () => {
  const nine = '2026-10-08T21:00:00.000Z';
  const ten = '2026-10-08T22:00:00.000Z';

  it('rewinds to the earlier scan when the later one syncs first', () => {
    expect(earlierCheckIn(ten, nine)).toBe(nine);
  });

  it('leaves the record alone when the incoming scan is later', () => {
    expect(earlierCheckIn(nine, ten)).toBeNull();
  });

  it('leaves it alone when the two are the same moment', () => {
    expect(earlierCheckIn(nine, nine)).toBeNull();
  });

  it('never rewinds on missing or unparseable times', () => {
    expect(earlierCheckIn(null, nine)).toBeNull();
    expect(earlierCheckIn(ten, null)).toBeNull();
    expect(earlierCheckIn(ten, 'whenever')).toBeNull();
    expect(earlierCheckIn('whenever', nine)).toBeNull();
  });
});
