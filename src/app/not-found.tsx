import Link from 'next/link';
import { Footer } from '@/components/aurelia/chrome/Footer';
import { Header } from '@/components/aurelia/chrome/Header';
import { Ribbon } from '@/components/aurelia/chrome/Ribbon';
import { site } from '@/content/site';

const LINKS = [
  { href: '/menu', label: 'The menu' },
  { href: '/events', label: 'What’s on' },
  { href: '/private-events', label: 'Private dining' },
  { href: '/visit', label: 'Hours & directions' },
];

/** 404: a wrong door, not a dead end. */
export default function NotFound() {
  return (
    <div className="cn-site">
      <Ribbon />
      <Header reservationUrl={site.reservationUrl} phone={site.phone.value} />
      <main id="main" className="cn-page-hero cn-page-hero-compact cn-grain" style={{ minHeight: '80svh' }}>
        <span className="cn-candles" aria-hidden="true" />
        <div className="cn-wrap relative z-[2]">
          <p className="cn-eyebrow">404 — wrong door</p>
          <h1 className="cn-display cn-xl mt-6">
            This room is <em>closed tonight.</em>
          </h1>
          <p className="cn-lede mt-6">The page you were looking for has moved or never existed. The rest of the house is open.</p>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="cn-link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Link href="/" className="cn-btn">
              Back to the dining room <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
