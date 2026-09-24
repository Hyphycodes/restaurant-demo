import Link from 'next/link';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { groupHours } from '@/lib/hours';
import { MotionScope } from '../motion/MotionScope';
import { aureliaDrawerNav, aureliaHouseNav } from './nav';

export async function Footer() {
  const site = await getSiteSettings();
  const hours = groupHours(site.hours.value);
  const year = new Date().getFullYear();

  return (
    <footer className="cn-footer cn-grain">
      <MotionScope className="cn-wrap" as="div">
        <div className="cn-footer-grid" style={{ paddingTop: 'clamp(72px, 9vw, 140px)' }}>
          <div>
            <p className="cn-eyebrow">Last call is a suggestion</p>
            <h2 className="mt-5" data-m="title">
              Stay for dinner. <em className="cn-italic" style={{ color: 'var(--cn-candle)' }}>Leave much later.</em>
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={site.reservationUrl} className="cn-btn">
                Find your table <span className="cn-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/events" className="cn-btn cn-btn-ghost">
                See what&apos;s on
              </Link>
            </div>
          </div>
          <div>
            <h3 className="cn-eyebrow">The house</h3>
            <ul>
              {aureliaDrawerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="cn-eyebrow">Hours</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4">
              {hours.map((group) => (
                <div key={group.label} className="contents">
                  <dt>{group.label}</dt>
                  <dd className="cn-num">{group.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="cn-eyebrow">Find us</h3>
            <address>
              {site.street}, {site.locality}
              <br />
              <a href={formatPhoneHref(site.phone.value)} className="hover:text-[color:var(--cn-candle)]">
                {site.phone.value}
              </a>
            </address>
            <ul className="mt-4">
              {aureliaHouseNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="cn-footer-mark mt-16" aria-hidden="true" data-m="up">
          Casa <em>Aurelia</em>
        </p>
        <div className="cn-footer-base">
          <span>© {year} Casa Aurelia — a fictional supper club, designed and built by Hyphy Studio.</span>
          <span className="flex gap-5">
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/demo">Platform demo</Link>
            <Link href="/contact">Contact</Link>
          </span>
        </div>
      </MotionScope>
    </footer>
  );
}
