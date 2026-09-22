import { describe, expect, it } from 'vitest';
import { formatEventDateCompact, formatTimeRangeCompact } from './format';

describe('compact event facts', () => {
  it('writes the date without a comma', () => {
    expect(formatEventDateCompact('2026-09-19T17:00:00Z')).toBe('Sat Sep 19');
  });
  it('shares the suffix and drops :00', () => {
    expect(formatTimeRangeCompact('2026-09-19T17:00:00Z', '2026-09-19T20:00:00Z')).toBe('12–3pm');
    expect(formatTimeRangeCompact('2026-09-19T00:00:00Z', '2026-09-19T03:00:00Z')).toBe('7–10pm');
  });
  it('keeps both suffixes across midnight', () => {
    expect(formatTimeRangeCompact('2026-09-19T02:30:00Z', '2026-09-19T06:00:00Z')).toBe('9:30pm–1am');
  });
});
