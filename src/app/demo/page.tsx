import type { Metadata } from 'next';
import Link from 'next/link';
import { MotionScope } from '@/components/aurelia/motion/MotionScope';
import { PageHero } from '@/components/aurelia/page/PageHero';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { getActiveTheme } from '@/themes/resolve';

export const metadata: Metadata = {
  title: 'Explore the platform — Casa Aurelia',
  description: 'A fictional supper club running on a real restaurant platform. Explore the guest site, the operating room and the staff workspace with safe sample data.',
};
export const dynamic = 'force-dynamic';

const DOORS = [
  {
    n: '01',
    title: 'The restaurant',
    who: 'As a guest',
    points: ['A cinematic site with the live menu', 'Events, tickets and private dining', 'Reservations and pickup, simulated'],
    href: '/',
    cta: 'Walk in the front door',
  },
  {
    n: '02',
    title: 'The operating room',
    who: 'As the owner',
    points: ['Tonight at a glance', 'Content studio, menu and media', 'Events, tickets and the enquiry pipeline'],
    href: '/demo/admin',
    cta: 'Open the admin',
  },
  {
    n: '03',
    title: 'The staff workspace',
    who: 'As a bartender',
    points: ['Today’s shift and the next one', 'Checklists, announcements, training', 'Open shifts up for grabs'],
    href: '/demo/staff',
    cta: 'Start a shift',
  },
];

const TOUR = [
  { step: 'Send a private-dining enquiry', then: 'watch it land in the admin pipeline as “New”.', href: '/private-events#inquiry' },
  { step: 'Change a dish’s price or mark it “not tonight”', then: 'and read the change on the public menu.', href: '/admin/menu' },
  { step: 'Build next week’s schedule as the manager', then: 'publish it and see it in the staff app.', href: '/demo/manager' },
  { step: 'Tick off the opening checklist as Marco', then: 'with a photo, a note and a timestamp.', href: '/demo/staff' },
  { step: 'Open the signage view on a TV', then: 'tonight’s event and a QR, rotating on their own.', href: '/display' },
  { step: 'Scan the projector QR page', then: 'one of six link pages the owner manages.', href: '/go/tonight' },
];

export default async function DemoHubPage() {
  const theme = await getActiveTheme();
  return (
    <SiteChrome theme={theme}>
      <PageHero
        eyebrow="Explore the platform"
        title={
          <>
            A fictional supper club. <em>A real restaurant platform.</em>
          </>
        }
        lede="Casa Aurelia is imagined; the software is not. Three doors into one connected system — use any of them, change anything, and reset whenever you like."
        compact
      />
      <MotionScope as="section" className="cn-night cn-section-tight" aria-label="Choose a way in">
        <div className="cn-wrap">
          <div className="cn-doors" data-m="stagger">
            {DOORS.map((door) => (
              <Link key={door.href} href={door.href} className="cn-door">
                <span className="cn-door-num">{door.n}</span>
                <div>
                  <p className="cn-eyebrow">{door.who}</p>
                  <h2 className="mt-3">{door.title}</h2>
                  <ul>
                    {door.points.map((point) => (
                      <li key={point}>— {point}</li>
                    ))}
                  </ul>
                </div>
                <span className="cn-door-go">
                  {door.cta} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </MotionScope>
      <MotionScope as="section" className="cn-paper cn-grain cn-section" aria-labelledby="tour-title">
        <div className="cn-wrap cn-two-col">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Six things to try
            </p>
            <h2 id="tour-title" className="cn-display cn-lg mt-4" data-m="title">
              Change it here. <em>See it there.</em>
            </h2>
            <p className="cn-lede mt-6" data-m="up">
              Everything is connected to everything else: the public site, the admin and the staff app read and write the same
              records. Your changes live only in your browser for an hour — nobody else sees them, and nothing real is sent,
              booked or charged.
            </p>
            <div className="mt-8 flex flex-wrap gap-3" data-m="up">
              <a href="/demo/reset" className="cn-btn cn-btn-ghost">
                Reset my demo
              </a>
              <Link href="/behind" className="cn-link">
                How it fits together →
              </Link>
            </div>
          </div>
          <ol className="cn-tour" data-m="stagger">
            {TOUR.map((item, index) => (
              <li key={item.step}>
                <span className="cn-num">{String(index + 1).padStart(2, '0')}</span>
                <Link href={item.href}>
                  <b>{item.step}</b> {item.then}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </MotionScope>
    </SiteChrome>
  );
}
