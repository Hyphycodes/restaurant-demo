/**
 * The pricing engine, mirrored.
 *
 * The real one is `price_order()` in supabase/migrations/0007_ticketing_core.sql
 * and runs inside `reserve_order`. This copy exists for optimistic display only
 * — a checkout summary can be drawn before the server answers — and if the
 * two ever disagree the client re-renders from the server's numbers. The unit
 * tests here pin the formula so a change to one side has to be made to both.
 *
 * Money is integer cents throughout. `round` is half-up, matching Postgres.
 */

export type FeeDisplay = 'inclusive' | 'itemized';

export interface PricingConfig {
  feeDisplay: FeeDisplay;
  taxRateBps: number;
  serviceFeeBps: number;
  serviceFeeFlatCents: number;
}

export interface Promo {
  kind: 'percent' | 'amount';
  value: number;
}

export interface PricedOrder {
  faceCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

/** Half-up rounding on a non-negative value, like Postgres `round()`. */
export function roundCents(value: number): number {
  return Math.round(value);
}

export function discountFor(faceCents: number, promo: Promo | null): number {
  if (!promo) return 0;
  if (promo.kind === 'percent') return roundCents((faceCents * promo.value) / 100);
  return Math.min(promo.value, faceCents);
}

export function priceOrder(
  lines: { priceCents: number; quantity: number }[],
  config: PricingConfig,
  promo: Promo | null = null,
): PricedOrder {
  const faceCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const discountCents = discountFor(faceCents, promo);
  const net = faceCents - discountCents;

  if (config.feeDisplay === 'itemized') {
    const serviceFeeCents = roundCents((net * config.serviceFeeBps) / 10000) + config.serviceFeeFlatCents;
    const taxCents = roundCents(((net + serviceFeeCents) * config.taxRateBps) / 10000);
    return {
      faceCents,
      subtotalCents: faceCents,
      serviceFeeCents,
      taxCents,
      discountCents,
      totalCents: net + serviceFeeCents + taxCents,
    };
  }

  const totalCents = net;
  const taxCents = roundCents((totalCents * config.taxRateBps) / (10000 + config.taxRateBps));
  const serviceFeeCents =
    roundCents(((totalCents - taxCents) * config.serviceFeeBps) / 10000) + config.serviceFeeFlatCents;
  return {
    faceCents,
    // Derived so the stored row still balances: subtotal + fee + tax − discount = total.
    subtotalCents: faceCents - taxCents - serviceFeeCents,
    serviceFeeCents,
    taxCents,
    discountCents,
    totalCents,
  };
}

/** The invariant every stored order must satisfy. */
export function balances(order: PricedOrder): boolean {
  return order.totalCents === order.subtotalCents + order.serviceFeeCents + order.taxCents - order.discountCents;
}
