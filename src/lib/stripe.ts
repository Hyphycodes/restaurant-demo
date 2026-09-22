import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import Stripe from 'stripe';

/**
 * One Stripe client, server-side only.
 *
 * The API version is pinned by the SDK release in package-lock.json (v22
 * pins its own current version); upgrading the SDK is how the version moves,
 * deliberately and with a diff. With no secret key configured there is no
 * client, and every caller says "checkout is not open" instead of throwing.
 */

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (DEMO_MODE) return null;
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    client = null;
    return client;
  }
  client = new Stripe(key, {
    appInfo: { name: 'Cosa Nostra Website', url: 'https://example.invalid/demo' },
    maxNetworkRetries: 2,
    timeout: 15_000,
  });
  return client;
}

export function isStripeConfigured(): boolean {
  if (DEMO_MODE) return false;
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

export function getWebhookSecret(): string | null {
  if (DEMO_MODE) return null;
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}
