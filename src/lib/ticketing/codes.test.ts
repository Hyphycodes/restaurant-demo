import { describe, expect, it } from 'vitest';
import { formatTicketCode, isOrderNumber, isTicketCode, normalizeCode, randomCrockford } from './codes';

describe('codes', () => {
  it('never uses an ambiguous letter', () => {
    for (let i = 0; i < 200; i += 1) expect(randomCrockford(8)).not.toMatch(/[ILOU]/);
  });
  it('forgives what a person types', () => {
    expect(normalizeCode('h7k4-m2q9')).toBe('H7K4M2Q9');
    expect(normalizeCode('h7k4 m2ql')).toBe('H7K4M2Q1');
    expect(normalizeCode('o0i1lu')).toBe('001111'.slice(0, 5) + 'V');
    expect(formatTicketCode('h7k4m2q9')).toBe('H7K4-M2Q9');
  });
  it('recognises shapes', () => {
    expect(isTicketCode('H7K4-M2Q9')).toBe(true);
    expect(isTicketCode('H7K4')).toBe(false);
    expect(isOrderNumber('cns-7k4m2')).toBe(true);
    expect(isOrderNumber('CNS-7K4M2X')).toBe(false);
  });
});
