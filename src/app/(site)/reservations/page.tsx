import type { Metadata } from 'next';
import { TableFinder } from '@/components/cosa/guest/TableFinder';
import { MotionScope } from '@/components/cosa/motion/MotionScope';
import { PageHero } from '@/components/cosa/page/PageHero';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { groupHours } from '@/lib/hours';

export const metadata: Metadata = {
  title: 'Find your table — Cosa Nostra',
  description: 'Choose a night, a time and a table at Cosa Nostra. A demonstration booking flow: nothing is booked.',
};

export default async function ReservationsPage() {
  const site = await getSiteSettings();
  const hours = groupHours(site.hours.value);
  return (
    <>
      <PageHero
        eyebrow="Reservations"
        title={
          <>
            There&apos;s a table <em>with your name on it.</em>
          </>
        }
        lede="Book up to two weeks out. The bar is always kept for walk-ins, and parties of nine or more have the back room."
        asset="roomDetail"
        focus={{ x: '45%', y: '55%' }}
        compact
      />
      <MotionScope as="section" className="cn-night cn-section-tight" aria-label="Find a table">
        <div className="cn-wrap cn-finder-layout">
          <div data-m="up">
            <TableFinder />
          </div>
          <aside className="cn-finder-aside" data-m="up" data-delay="0.2">
            <p className="cn-eyebrow">Good to know</p>
            <dl className="cn-num">
              {hours.map((group) => (
                <div key={group.label}>
                  <dt>{group.label}</dt>
                  <dd>{group.value}</dd>
                </div>
              ))}
            </dl>
            <p className="cn-body">
              Tables are held for fifteen minutes. The kitchen serves a late menu Friday and Saturday. Call{' '}
              <a href={formatPhoneHref(site.phone.value)} className="underline underline-offset-4">
                {site.phone.value}
              </a>{' '}
              for anything else.
            </p>
          </aside>
        </div>
      </MotionScope>
    </>
  );
}
