import type { Metadata } from 'next';
import Link from 'next/link';
import { MotionScope } from '@/components/aurelia/motion/MotionScope';
import { EditorialTitle } from '@/components/aurelia/page/EditorialTitle';
import { PageHero } from '@/components/aurelia/page/PageHero';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { getPublicOpenings } from '@/server/content/hiring';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.contact!, path: '/contact' });
export const dynamic = 'force-dynamic';

/** Every reason to get in touch, each with its own door. */
export default async function ContactPage() {
  const [site, copy, openings] = await Promise.all([getSiteSettings(), getPageCopy('contact'), getPublicOpenings()]);
  const doors = [
    { n: '01', title: 'A table', text: 'Tonight, this weekend, or a Tuesday you want to make better.', href: '/reservations', cta: 'Find your table' },
    { n: '02', title: 'A gathering', text: 'Private dining for 12 to 120, or catering that travels to you.', href: '/private-events', cta: 'Plan it with us' },
    {
      n: '03',
      title: 'A job',
      text: openings.length > 0 ? `${openings.length} ${openings.length === 1 ? 'role is' : 'roles are'} open in the kitchen, bar and dining room.` : 'Nothing posted right now — leave your name anyway.',
      href: '/careers',
      cta: 'Work with us',
    },
    { n: '04', title: 'A stage', text: 'Selectors, musicians, photographers and anyone with a night nobody has run yet.', href: '/talent', cta: 'Show us your work' },
  ];

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? pageCopy.contact.eyebrow}
        title={<EditorialTitle text={copy.heading} />}
        lede={copy.body ?? pageCopy.contact.body}
        asset="roomDetail"
        focus={{ x: '45%', y: '55%' }}
        compact
        aside={
          <div className="grid gap-2">
            <a href={formatPhoneHref(site.phone.value)} className="cn-link">
              {site.phone.value}
            </a>
            {site.email ? (
              <a href={`mailto:${site.email}`} className="cn-link">
                {site.email}
              </a>
            ) : null}
          </div>
        }
      />
      <MotionScope as="section" className="cn-night cn-section-tight" aria-label="Ways to reach us">
        <div className="cn-wrap">
          <div className="cn-doors cn-doors-4" data-m="stagger">
            {doors.map((door) => (
              <Link key={door.href} href={door.href} className="cn-door">
                <span className="cn-door-num">{door.n}</span>
                <div>
                  <h2>{door.title}</h2>
                  <p className="cn-body mt-3">{door.text}</p>
                </div>
                <span className="cn-door-go">
                  {door.cta} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="cn-body mt-10">
            Press and partnerships: {site.email ?? 'hello@example.invalid'}. Casa Aurelia is a fictional supper club built as a
            portfolio experience — messages sent here stay inside the demo.
          </p>
        </div>
      </MotionScope>
    </>
  );
}
