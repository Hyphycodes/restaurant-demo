import { describe, expect, it } from 'vitest';
import { feePreview, stripeFeeCents } from './fees';

describe('stripe fee preview', () => {
  it('matches the launch checklist table to the cent', () => {
    expect(stripeFeeCents(1000)).toBe(59);
    expect(stripeFeeCents(1200)).toBe(65);
    expect(stripeFeeCents(1500)).toBe(74);
    expect(stripeFeeCents(2500)).toBe(103);
    expect(stripeFeeCents(2000)).toBe(88);
  });
  it('shows what the owner keeps and flags cheap tickets', () => {
    expect(feePreview(1000)).toMatchObject({ keepCents: 941, ratePercent: 5.9, warning: null });
    expect(feePreview(600).warning).toMatch(/Under \$8/);
    expect(feePreview(0)).toMatchObject({ feeCents: 0, keepCents: 0 });
  });
});
