import type { Metadata } from 'next';
import { Band, Frame } from '@/components/primitives/Band';
import { PageHeader } from '@/components/primitives/PageHeader';
import { site } from '@/content/site';
import { formatPhoneHref } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Ticket terms — Cosa Nostra',
  description: 'What a ticket to an Cosa Nostra event gets you, our refund policy, age rules, and what happens if an event changes.',
  path: '/legal/tickets',
});

/**
 * Plain terms, written to be read on a phone in the checkout. Linked from the
 * consent line at checkout and from every ticket email. The refund line on an
 * individual event can be more generous than this; it is shown at checkout
 * and kept on the order.
 */
export default function TicketTermsPage() {
  return (
    <>
      <PageHeader eyebrow="Tickets" heading="Ticket terms." body="The short version of what you agree to when you buy a ticket here." />
      <Band surface="cream">
        <Frame>
          <div className="measure space-y-8 text-[0.9375rem] leading-relaxed text-brown-soft">
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">What a ticket gets you</h2>
              <p className="mt-3">
                A seat at the event named on it, on the date and time it says, at {site.name}, {site.street}, {site.locality}. Anything the event page lists as included — aperitivo, antipasti, dinner — is included. Food and drink beyond that is bought as usual.
              </p>
            </section>
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">Refunds</h2>
              <p className="mt-3">
                Unless the event page says otherwise: a full refund if you ask at least 48 hours before the event starts. After that we cannot refund, but we will move you to another date of the same event when there is one. Refunds go back to the card you paid with and take a few days to show.
              </p>
            </section>
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">Getting in</h2>
              <p className="mt-3">
                Show the QR code from your email or your tickets page at the door, on your phone or printed. Each code lets one person in once. If an event is 18+ or 21+, bring ID; we cannot refund a ticket we could not admit.
              </p>
            </section>
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">If an event changes</h2>
              <p className="mt-3">
                If we move an event, your ticket carries over to the new date and you can ask for a full refund instead. If we cancel an event, every ticket is refunded in full and you will be emailed.
              </p>
            </section>
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">Photos</h2>
              <p className="mt-3">
                We sometimes take photos and short videos at events for our own social media. Tell a member of staff on the night if you would rather not be in them.
              </p>
            </section>
            <section>
              <h2 className="text-[length:var(--text-heading)] font-semibold text-brown">Questions</h2>
              <p className="mt-3">
                Call us at{' '}
                <a href={formatPhoneHref(site.phone.value)} className="tabular text-brown underline underline-offset-4">{site.phone.value}</a>. Your order number is in your ticket email.
              </p>
            </section>
          </div>
        </Frame>
      </Band>
    </>
  );
}
