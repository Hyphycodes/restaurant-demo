import { describe, expect, it } from 'vitest';
import { balances, priceOrder, type PricingConfig } from './pricing';

const inclusive: PricingConfig = { feeDisplay: 'inclusive', taxRateBps: 0, serviceFeeBps: 0, serviceFeeFlatCents: 0 };
const itemized: PricingConfig = { feeDisplay: 'itemized', taxRateBps: 0, serviceFeeBps: 0, serviceFeeFlatCents: 0 };

describe('priceOrder', () => {
  it('single tier, inclusive, no fees: the guest pays the listed price', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 2 }], inclusive);
    expect(order.totalCents).toBe(2000);
    expect(order.subtotalCents).toBe(2000);
    expect(balances(order)).toBe(true);
  });

  it('mixed tiers add up', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 2 }, { priceCents: 600, quantity: 1 }], inclusive);
    expect(order.faceCents).toBe(2600);
    expect(order.totalCents).toBe(2600);
    expect(balances(order)).toBe(true);
  });

  it('percent promo rounds half-up once', () => {
    const order = priceOrder([{ priceCents: 1250, quantity: 1 }], inclusive, { kind: 'percent', value: 15 });
    // 1250 × 0.15 = 187.5 → 188
    expect(order.discountCents).toBe(188);
    expect(order.totalCents).toBe(1062);
    expect(balances(order)).toBe(true);
  });

  it('amount promo larger than the subtotal is capped at the subtotal', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 1 }], inclusive, { kind: 'amount', value: 5000 });
    expect(order.discountCents).toBe(1000);
    expect(order.totalCents).toBe(0);
    expect(balances(order)).toBe(true);
  });

  it('zero-price tier is free and still balances', () => {
    const order = priceOrder([{ priceCents: 0, quantity: 3 }], { ...itemized, serviceFeeBps: 290, serviceFeeFlatCents: 30 });
    expect(order.totalCents).toBe(30);
    expect(order.serviceFeeCents).toBe(30);
    expect(balances(order)).toBe(true);
  });

  it('itemized adds fee then tax on top', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 2 }], { feeDisplay: 'itemized', taxRateBps: 1000, serviceFeeBps: 500, serviceFeeFlatCents: 50 });
    // net 2000 → service 100 + 50 = 150 → tax 10% of 2150 = 215 → total 2365
    expect(order.serviceFeeCents).toBe(150);
    expect(order.taxCents).toBe(215);
    expect(order.totalCents).toBe(2365);
    expect(order.subtotalCents).toBe(2000);
    expect(balances(order)).toBe(true);
  });

  it('inclusive backs tax and fee out of the listed price', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 2 }], { feeDisplay: 'inclusive', taxRateBps: 1000, serviceFeeBps: 500, serviceFeeFlatCents: 50 });
    // total 2000 → tax 2000 × 1000/11000 = 181.8 → 182 → service 5% of 1818 = 90.9 → 91 + 50 = 141
    expect(order.totalCents).toBe(2000);
    expect(order.taxCents).toBe(182);
    expect(order.serviceFeeCents).toBe(141);
    expect(order.subtotalCents).toBe(2000 - 182 - 141);
    expect(balances(order)).toBe(true);
  });

  it('a tax rate that produces a half cent rounds half-up and still balances', () => {
    // 8.25% on $10 itemized = 82.5 → 83
    const order = priceOrder([{ priceCents: 1000, quantity: 1 }], { feeDisplay: 'itemized', taxRateBps: 825, serviceFeeBps: 0, serviceFeeFlatCents: 0 });
    expect(order.taxCents).toBe(83);
    expect(order.totalCents).toBe(1083);
    expect(balances(order)).toBe(true);
  });

  it('inclusive with a discount still balances the stored row', () => {
    const order = priceOrder([{ priceCents: 1000, quantity: 2 }], { feeDisplay: 'inclusive', taxRateBps: 825, serviceFeeBps: 290, serviceFeeFlatCents: 30 }, { kind: 'amount', value: 500 });
    expect(order.totalCents).toBe(1500);
    expect(balances(order)).toBe(true);
  });
});
