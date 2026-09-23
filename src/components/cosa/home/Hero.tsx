import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import { eventHref } from '@/components/events/EventBits';
import type { ResolvedEvent } from '@/content/types';
import { formatEventTime } from '@/lib/format';
import { HeroDirector } from './HeroDirector';

export function Hero({
  reservationUrl,
  openLabel,
  isOpen,
  next,
}: {
  reservationUrl: string;
  openLabel: string;
  isOpen: boolean;
  next: ResolvedEvent | null;
}) {
  const nextDay = next
    ? new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).format(new Date(next.startsAt))
    : null;

  return (
    <HeroDirector>
      <div className="cn-hero-media" aria-hidden="true">
        <div className="cn-hero-media-inner">
          <Asset id="roomNight" priority rounded={false} className="cn-hero-wide" sizes="100vw" alt="" />
          <Asset id="roomNightTall" priority rounded={false} className="cn-hero-tall" sizes="100vw" alt="" />
        </div>
      </div>
      <span className="cn-candles" aria-hidden="true" style={{ ['--cx1' as string]: '56%', ['--cy1' as string]: '76%' }} />
      <span className="cn-hero-dusk" aria-hidden="true" />

      <div className="cn-wrap cn-hero-content">
        <p className="cn-eyebrow cn-hero-kicker" data-m>
          Cosa Nostra <span aria-hidden="true">·</span> Italian supper club <span aria-hidden="true">·</span> West Loop, Chicago
        </p>

        <h1 id="hero-title" className="cn-display cn-hero-title" data-m>
          <span className="cn-hero-line">Stay for dinner.</span>
          <span className="cn-hero-line cn-hero-line-2">
            <em>Leave much later.</em>
          </span>
        </h1>

        <span className="cn-hero-rule" aria-hidden="true" data-m />

        <div className="cn-hero-foot">
          <p className="cn-lede" data-m>
            Handmade pasta, stirred drinks and a room that gets better the longer you stay. Dinner nightly from four.
          </p>
          <div className="cn-hero-actions" data-m>
            <Link href={reservationUrl} className="cn-btn">
              Find your table <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/events" className="cn-btn cn-btn-ghost">
              See what&apos;s on
            </Link>
          </div>
          <dl className="cn-hero-status" data-m>
            <div>
              <dt className="cn-eyebrow">Tonight</dt>
              <dd>
                <span className="cn-dot" data-live={isOpen} aria-hidden="true" /> {openLabel}
              </dd>
            </div>
            {next ? (
              <div>
                <dt className="cn-eyebrow">Next on</dt>
                <dd>
                  <Link href={eventHref(next)} className="hover:text-[color:var(--cn-candle)]">
                    {next.title}
                  </Link>
                  <span className="cn-num block text-[color:var(--cn-haze)]">
                    {nextDay} · {formatEventTime(next.startsAt)}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <p className="cn-hero-cue" aria-hidden="true" data-m>
        <span>The evening begins</span>
        <i />
      </p>
    </HeroDirector>
  );
}
