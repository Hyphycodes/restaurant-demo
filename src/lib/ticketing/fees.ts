/**
 * What a ticket price means for the restaurant.
 *
 * Stripe's standard US online rate: 2.9% + 30¢ per successful card charge,
 * charged per order. The preview in the editor uses it so the owner sees the
 * real economics before publishing — and sees why a $7 ticket loses more than
 * 6% to the fixed 30¢.
 */

export const STRIPE_PERCENT_BPS = 290;
export const STRIPE_FIXED_CENTS = 30;

export function stripeFeeCents(chargeCents: number): number {
  if (chargeCents <= 0) return 0;
  return Math.round((chargeCents * STRIPE_PERCENT_BPS) / 10000) + STRIPE_FIXED_CENTS;
}

export interface FeePreview {
  guestPaysCents: number;
  feeCents: number;
  keepCents: number;
  /** Effective rate, in percent, one decimal. */
  ratePercent: number;
  /** A note when the fixed fee bites hard. */
  warning: string | null;
}

export function feePreview(priceCents: number): FeePreview {
  const fee = stripeFeeCents(priceCents);
  const keep = Math.max(0, priceCents - fee);
  const rate = priceCents > 0 ? Math.round((fee / priceCents) * 1000) / 10 : 0;
  return {
    guestPaysCents: priceCents,
    feeCents: fee,
    keepCents: keep,
    ratePercent: rate,
    warning:
      priceCents > 0 && priceCents < 800
        ? `Under $8 the fixed 30¢ eats over 6%. A slightly higher all-in price, or a two-ticket bundle, keeps more.`
        : null,
  };
}
