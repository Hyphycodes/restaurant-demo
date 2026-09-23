import Link from 'next/link';
import type { SiteSettings } from '@/content/types';
import { formatPhoneHref } from '@/lib/format';
import { groupHours } from '@/lib/hours';
import { MotionScope } from '../motion/MotionScope';

export function VisitBand({ site, openLabel, isOpen }: { site: SiteSettings; openLabel: string; isOpen: boolean }) {
  const hours = groupHours(site.hours.value);
  return (
    <MotionScope as="section" className="cn-paper cn-grain cn-section-tight cn-visit-band" aria-labelledby="visit-band-title">
      <div className="cn-wrap cn-visit-band-grid">
        <div>
          <p className="cn-eyebrow" data-m="up">
            Find us
          </p>
          <h2 id="visit-band-title" className="cn-display cn-md mt-4" data-m="title">
            A green door on a <em>quiet West Loop street.</em>
          </h2>
          <p className="cn-body mt-5" data-m="up">
            Look for the brass sconce and the small sign. Valet on Fridays and Saturdays; the Morgan stop on the Green and Pink
            lines is a five-minute walk. <em>(Cosa Nostra is fictional — no street address is published.)</em>
          </p>
        </div>
        <dl className="cn-visit-hours cn-num" data-m="stagger">
          <div className="cn-visit-now">
            <dt className="cn-eyebrow">Right now</dt>
            <dd>
              <span className="cn-dot" data-live={isOpen} aria-hidden="true" /> {openLabel}
            </dd>
          </div>
          {hours.map((group) => (
            <div key={group.label}>
              <dt>{group.label}</dt>
              <dd>{group.value}</dd>
            </div>
          ))}
        </dl>
        <div className="cn-visit-actions" data-m="up">
          <Link href="/visit" className="cn-btn">
            Hours &amp; directions <span className="cn-arrow" aria-hidden="true">→</span>
          </Link>
          <a href={formatPhoneHref(site.phone.value)} className="cn-link">
            {site.phone.value}
          </a>
        </div>
      </div>
    </MotionScope>
  );
}
