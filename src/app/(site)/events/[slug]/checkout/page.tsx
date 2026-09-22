import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { Frame } from '@/components/primitives/Band';
import { getSiteSettings } from '@/content/resolve';
import { PRESET_STYLE } from '@/content/event-presentation';
import { findStandaloneEvent } from '@/lib/events';
import { formatEventDateCompact, formatPhoneHref, formatPrice, formatTimeRangeCompact } from '@/lib/format';
import { absoluteUrl } from '@/lib/site-url';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { isSigningConfigured, signOrderToken } from '@/lib/ticketing/tokens';
import { getPublicEvents } from '@/server/content/events';
import { resolveEventArtwork } from '@/server/content/event-art';
import { getOrderByNumber, holdIsLive, isPaidStatus } from '@/server/ticketing/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout — Cosa Nostra', robots: { index: false, follow: false } };

/**
 * Checkout, in our own page, in the event's own colours.
 *
 * Left: the flyer, the name, when, the order lines and the total in the
 * largest type on the page. Right: the payment form. Nothing here computes a
 * price; every number is read back off the reserved order.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const [{ slug }, { order: orderNumber }] = await Promise.all([params, searchParams]);
  if (!orderNumber) notFound();

  const [input, settings, order] = await Promise.all([getPublicEvents(), getSiteSettings(), getOrderByNumber(orderNumber)]);
  const event = findStandaloneEvent(input, slug);
  if (!event || !order || order.eventId !== event.overrideId) notFound();

  if (isPaidStatus(order.status)) {
    redirect(`/tickets/${order.orderNumber}?t=${encodeURIComponent(signOrderToken(order.id))}`);
  }

  const artwork = await resolveEventArtwork(event);
  const flyer = artwork.flyer;
  const preset = PRESET_STYLE[event.presentation.visualPreset];
  const inclusive = event.ticketing.feeDisplay === 'inclusive';
  const refundPolicy = event.ticketing.refundPolicy?.trim() || 'Tickets are non-refundable, but we will move you to another date if you ask before the event.';
  const consentText = `${refundPolicy} By paying you agree to our ticket terms.`;

  const stripe = getStripe();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  const live = holdIsLive(order);
  let clientSecret: string | null = null;
  if (live && stripe && order.stripePaymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      clientSecret = intent.status === 'succeeded' ? null : intent.client_secret;
      if (intent.status === 'succeeded') {
        // The webhook is about to pay this order; send the guest where it lands.
        redirect(`/tickets/${order.orderNumber}?t=${encodeURIComponent(signOrderToken(order.id))}`);
      }
    } catch (error) {
      console.error('[checkout] payment intent retrieve failed:', error instanceof Error ? error.message : error);
    }
  }

  const ready = live && Boolean(clientSecret) && isStripeConfigured() && isSigningConfigured();
  const returnUrl = absoluteUrl(`/tickets/${order.orderNumber}?t=${encodeURIComponent(isSigningConfigured() ? signOrderToken(order.id) : '')}`);

  return (
    <section
      className="o-band relative isolate bg-espresso on-dark py-(--spacing-band-sm)"
      style={{ '--e-accent': preset.accent } as React.CSSProperties}
      aria-labelledby="checkout-title"
    >
      <Frame wide>
        <p className="text-[0.875rem] text-night-soft">
          <Link href={`/events/${event.slug}`} className="underline underline-offset-4">
            {event.title}
          </Link>
        </p>
        <h1 id="checkout-title" className="display mt-2 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-none text-night-text">
          Checkout
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* What they are buying. */}
          <div className="lg:col-span-5">
            <div className="flex gap-4">
              {flyer?.path ? (
                <div className="w-24 shrink-0 overflow-hidden rounded-(--radius-md) p-1 sm:w-32" style={{ background: preset.surface }}>
                  <Image src={flyer.path} alt="" width={flyer.width || 400} height={flyer.height || 400} sizes="128px" className="h-auto w-full rounded-(--radius-sm)" />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="display text-[1.5rem] leading-[1.02] text-night-text">{event.title}</p>
                <p className="tabular mt-2 text-[0.9375rem] text-night-soft">
                  {formatEventDateCompact(event.startsAt)} · {formatTimeRangeCompact(event.startsAt, event.endsAt)}
                </p>
                <p className="mt-1 text-[0.9375rem] text-night-soft">{event.venueName}, {settings.locality}</p>
              </div>
            </div>

            <dl className="mt-8 divide-y divide-night-text/10 border-y border-night-text/10 text-[1rem] text-night-text">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-3">
                  <dt className="tabular">
                    {item.quantity} × {item.tierName}{' '}
                    <span className="text-night-soft">{formatPrice(item.unitPriceCents)}</span>
                  </dt>
                  <dd className="tabular">{formatPrice(item.subtotalCents)}</dd>
                </div>
              ))}
              {order.discountCents > 0 ? (
                <div className="flex justify-between gap-4 py-3">
                  <dt>Discount</dt>
                  <dd className="tabular">−{formatPrice(order.discountCents)}</dd>
                </div>
              ) : null}
              {!inclusive && order.serviceFeeCents > 0 ? (
                <div className="flex justify-between gap-4 py-3">
                  <dt>Service fee</dt>
                  <dd className="tabular">{formatPrice(order.serviceFeeCents)}</dd>
                </div>
              ) : null}
              {!inclusive && order.taxCents > 0 ? (
                <div className="flex justify-between gap-4 py-3">
                  <dt>Tax</dt>
                  <dd className="tabular">{formatPrice(order.taxCents)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <p className="text-[1.0625rem] font-semibold text-night-text">Total</p>
              <p className="display tabular text-[clamp(2.25rem,5vw,3.25rem)] leading-none text-night-text">{formatPrice(order.totalCents)}</p>
            </div>
            {inclusive ? <p className="mt-2 text-[0.875rem] text-night-soft">Tax and fees included.</p> : null}
            <p className="mt-6 text-[0.8125rem] text-night-soft">Order {order.orderNumber}</p>
          </div>

          {/* How they pay. */}
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-(--radius-lg) border border-night-text/12 bg-espresso-lift/80 p-5 sm:p-6">
              {/* Payments off is not an error the guest can do anything about,
                  so it never reaches the form: the page says so and hands them
                  the phone. */}
              {!isStripeConfigured() ? (
                <PayByPhone
                  heading="Card payments are not switched on yet."
                  phone={settings.phone.value}
                  orderNumber={order.orderNumber}
                  eventSlug={event.slug ?? slug}
                />
              ) : ready ? (
                <CheckoutForm
                  publishableKey={publishableKey}
                  clientSecret={clientSecret!}
                  orderNumber={order.orderNumber}
                  eventId={order.eventId}
                  eventSlug={event.slug ?? slug}
                  totalCents={order.totalCents}
                  expiresAt={order.expiresAt ?? new Date(Date.now() + 60_000).toISOString()}
                  returnUrl={returnUrl}
                  consentText={consentText}
                  items={order.items.map((item) => ({ tierId: item.tierId, quantity: item.quantity }))}
                />
              ) : !live ? (
                <CheckoutForm
                  publishableKey={publishableKey || 'pk_unused'}
                  clientSecret=""
                  orderNumber={order.orderNumber}
                  eventId={order.eventId}
                  eventSlug={event.slug ?? slug}
                  totalCents={order.totalCents}
                  expiresAt={new Date(0).toISOString()}
                  returnUrl={returnUrl}
                  consentText={consentText}
                  items={order.items.map((item) => ({ tierId: item.tierId, quantity: item.quantity }))}
                />
              ) : (
                <PayByPhone
                  heading="We could not start the payment just now."
                  phone={settings.phone.value}
                  orderNumber={order.orderNumber}
                  eventSlug={event.slug ?? slug}
                />
              )}
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}

/**
 * The way through when a card cannot be taken on this page — payments are not
 * switched on yet, or the payment could not be started. The seats are held,
 * the order number is right there on the left, and on a phone the number is
 * one tap.
 */
function PayByPhone({
  heading,
  phone,
  orderNumber,
  eventSlug,
}: {
  heading: string;
  phone: string;
  orderNumber: string;
  eventSlug: string;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-[1.125rem] font-semibold text-night-text">{heading}</p>
      <p className="text-[0.9375rem] leading-relaxed text-night-soft">
        Nothing was charged. Call us and read out order {orderNumber} — we will take the payment and
        hold your seats.
      </p>
      <a
        href={formatPhoneHref(phone)}
        className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-(--radius-md) bg-amber px-6 text-[1.0625rem] font-semibold text-on-orange transition-colors hover:bg-amber-bright"
      >
        Call {phone}
      </a>
      <Link
        href={`/events/${eventSlug}`}
        className="inline-flex min-h-11 items-center text-[0.9375rem] text-night-text underline underline-offset-4"
      >
        Back to the event
      </Link>
    </div>
  );
}
