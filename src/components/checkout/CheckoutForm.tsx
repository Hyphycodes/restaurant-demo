'use client';

import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatPrice } from '@/lib/format';

/**
 * The payment half of checkout.
 *
 * Wallets first (Apple Pay, Google Pay, Link), a thin divider, then the card
 * form. Name and email are ours, collected above the payment section, because
 * the email is where the ticket goes and Stripe's receipt should match. The
 * exact consent line is posted with them before the payment is confirmed.
 *
 * Fulfilment never happens here. The success redirect lands on the tickets
 * page, which waits for the webhook.
 */

export interface CheckoutItem {
  tierId: string;
  quantity: number;
}

export interface CheckoutFormProps {
  publishableKey: string;
  clientSecret: string;
  orderNumber: string;
  eventId: string;
  eventSlug: string;
  totalCents: number;
  /** ISO. */
  expiresAt: string;
  returnUrl: string;
  consentText: string;
  items: CheckoutItem[];
}

const APPEARANCE: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#e8a33d',
    colorBackground: '#241708',
    colorText: '#f7eedc',
    colorTextSecondary: '#c4ac8c',
    colorTextPlaceholder: '#8c7a60',
    colorDanger: '#f5917f',
    colorIcon: '#c4ac8c',
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '16px',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid rgba(247,238,220,0.25)', boxShadow: 'none', padding: '12px 14px' },
    '.Input:focus': { border: '1px solid #e8a33d', boxShadow: 'none' },
    '.Label': { fontWeight: '600', fontSize: '14px', marginBottom: '6px' },
    '.Tab': { border: '1px solid rgba(247,238,220,0.2)' },
    '.Tab--selected': { borderColor: '#e8a33d' },
    '.Block': { backgroundColor: '#1a1008', border: '1px solid rgba(247,238,220,0.12)' },
  },
};

const FIELD =
  'mt-1.5 block min-h-12 w-full rounded-(--radius-md) border border-night-text/25 bg-obsidian/40 px-4 text-[1rem] text-night-text placeholder:text-night-soft/60 focus:border-amber';
const PRIMARY =
  'inline-flex min-h-12 w-full items-center justify-center rounded-(--radius-md) bg-amber px-6 text-[1.0625rem] font-semibold text-on-orange transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-50';

export function CheckoutForm(props: CheckoutFormProps) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  const [expired, setExpired] = useState(() => Date.parse(props.expiresAt) <= Date.now());

  if (expired) return <Expired {...props} />;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: APPEARANCE,
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&display=swap' }],
      }}
    >
      <Inner {...props} onExpired={() => setExpired(true)} />
    </Elements>
  );
}

function Inner(props: CheckoutFormProps & { onExpired: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [walletsAvailable, setWalletsAvailable] = useState<boolean | null>(null);
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'confirming' | 'error'; message?: string }>({ kind: 'idle' });
  const busy = state.kind === 'saving' || state.kind === 'confirming';

  const detailsOk = name.trim().length >= 2 && /.+@.+\..+/.test(email.trim());

  async function saveCustomer(details: { name: string; email: string; phone?: string }): Promise<boolean> {
    const response = await fetch(`/api/checkout/${encodeURIComponent(props.orderNumber)}/customer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...details, consentText: props.consentText }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; code?: string; message?: string } | null;
    if (response.ok && data?.ok) return true;
    if (data?.code === 'HOLD_EXPIRED') {
      props.onExpired();
      return false;
    }
    setState({ kind: 'error', message: data?.message ?? 'Could not save your details. Try again.' });
    return false;
  }

  async function confirm(billing: { name: string; email: string; phone?: string }) {
    if (!stripe || !elements) return;
    setState({ kind: 'confirming' });
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: props.returnUrl,
        receipt_email: billing.email,
        payment_method_data: {
          billing_details: { name: billing.name, email: billing.email, ...(billing.phone ? { phone: billing.phone } : {}) },
        },
      },
    });
    // Only reached when the confirmation did NOT redirect.
    if (error) {
      setState({
        kind: 'error',
        message:
          error.type === 'card_error' || error.type === 'validation_error'
            ? error.message ?? 'Your bank did not approve that. Try another card.'
            : 'Something went wrong on our side. Nothing was charged. Try again in a moment.',
      });
    }
  }

  async function onCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !detailsOk) return;
    setState({ kind: 'saving' });
    const details = { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined };
    if (await saveCustomer(details)) await confirm(details);
  }

  async function onWalletConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    const walletName = event.billingDetails?.name?.trim() || name.trim();
    const walletEmail = event.billingDetails?.email?.trim() || email.trim();
    if (!walletName || !/.+@.+\..+/.test(walletEmail)) {
      event.paymentFailed({ reason: 'fail', message: 'Enter your name and email above first.' });
      setState({ kind: 'error', message: 'Enter your name and email first, so we know where to send the tickets.' });
      return;
    }
    setState({ kind: 'saving' });
    const details = { name: walletName, email: walletEmail, phone: event.billingDetails?.phone?.trim() || phone.trim() || undefined };
    if (await saveCustomer(details)) await confirm(details);
  }

  return (
    <form onSubmit={onCardSubmit} className="grid gap-6" aria-busy={busy}>
      <HoldCountdown expiresAt={props.expiresAt} onExpired={props.onExpired} />

      <fieldset className="grid gap-4" disabled={busy}>
        <legend className="text-[1.0625rem] font-semibold text-night-text">Who the tickets are for</legend>
        <div>
          <label htmlFor="co-name" className="block text-[0.875rem] font-semibold text-night-text">Name</label>
          <input id="co-name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="co-email" className="block text-[0.875rem] font-semibold text-night-text">Email</label>
          <input id="co-email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
          <p className="mt-1.5 text-[0.8125rem] text-night-soft">This is where the tickets go.</p>
        </div>
        <div>
          <label htmlFor="co-phone" className="block text-[0.875rem] font-semibold text-night-text">
            Phone <span className="font-normal text-night-soft">(optional, for day-of texts only)</span>
          </label>
          <input id="co-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
        </div>
      </fieldset>

      <div className="grid gap-4">
        <div className={walletsAvailable === false ? 'hidden' : ''}>
          <ExpressCheckoutElement
            onConfirm={onWalletConfirm}
            onReady={({ availablePaymentMethods }) => setWalletsAvailable(Boolean(availablePaymentMethods))}
            options={{ buttonHeight: 48, buttonTheme: { applePay: 'white', googlePay: 'white' }, layout: { maxColumns: 1, overflow: 'never' } }}
          />
        </div>
        {walletsAvailable ? (
          <p className="flex items-center gap-3 text-[0.8125rem] text-night-soft" aria-hidden="true">
            <span className="h-px flex-1 bg-night-text/15" />
            or pay with card
            <span className="h-px flex-1 bg-night-text/15" />
          </p>
        ) : null}
        <PaymentElement options={{ layout: 'tabs', fields: { billingDetails: { name: 'never', email: 'never' } } }} />
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-night-soft">
        {props.consentText.replace(/ By paying you agree to our ticket terms\.$/, '')} By paying you agree to our{' '}
        <a href="/legal/tickets" target="_blank" rel="noopener" className="underline underline-offset-4">ticket terms</a>.
      </p>

      <button type="submit" className={PRIMARY} disabled={busy || !stripe || !elements || !detailsOk}>
        {state.kind === 'saving' ? 'Saving your details…' : state.kind === 'confirming' ? 'Talking to your bank…' : `Pay ${formatPrice(props.totalCents)}`}
      </button>

      {state.kind === 'error' ? (
        <p role="alert" className="rounded-(--radius-md) border border-amber/40 bg-amber/10 px-4 py-3 text-[0.9375rem] text-night-text">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function HoldCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(expiresAt) - Date.now()));
  const fired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
      setLeft(remaining);
      if (remaining === 0 && !fired.current) {
        fired.current = true;
        onExpired();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpired]);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return (
    <p className="tabular text-[0.9375rem] text-night-soft" aria-live="polite">
      Your seats are held for {minutes}:{String(seconds).padStart(2, '0')}.
    </p>
  );
}

function Expired(props: CheckoutFormProps) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'error'; message?: string }>({ kind: 'idle' });

  async function again() {
    setState({ kind: 'busy' });
    try {
      const response = await fetch('/api/checkout/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId: props.eventId, items: props.items }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; orderNumber?: string; message?: string } | null;
      if (response.ok && data?.orderNumber) {
        window.location.assign(`/events/${props.eventSlug}/checkout?order=${encodeURIComponent(data.orderNumber)}`);
        return;
      }
      setState({ kind: 'error', message: data?.message ?? 'Could not hold those seats again.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach us. Check your connection and try again.' });
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-[1.125rem] font-semibold text-night-text">Your hold expired. Nothing was charged.</p>
      <p className="text-[0.9375rem] leading-relaxed text-night-soft">
        Seats go back on sale after twelve minutes so nobody can sit on them. One tap holds them again if they are still free.
      </p>
      <button type="button" onClick={again} className={PRIMARY} disabled={state.kind === 'busy'}>
        {state.kind === 'busy' ? 'Holding your seats…' : 'Hold my seats again'}
      </button>
      {state.kind === 'error' ? (
        <p role="alert" className="text-[0.9375rem] text-amber">{state.message}</p>
      ) : null}
      <a href={`/events/${props.eventSlug}`} className="inline-flex min-h-11 items-center text-[0.9375rem] text-night-text underline underline-offset-4">
        Back to the event
      </a>
    </div>
  );
}
