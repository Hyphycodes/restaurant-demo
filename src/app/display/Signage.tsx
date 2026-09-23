'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * The rotation, the clock and nothing else.
 *
 * Every slide is rendered once, stacked, and the active one fades up over the
 * last; with reduced motion the change is a cut, but it still turns over.
 * The page quietly re-reads the server every ten minutes, so a screen left on
 * from opening to close picks up a changed event or a sold-out night without
 * anyone touching it. Arrow keys step through the slides for whoever is
 * setting it up.
 */

export interface SignageSlide {
  id: string;
  label: string;
  node: ReactNode;
}

const REFRESH_MS = 10 * 60_000;

export function Signage({ slides, interval, timeZone, venue }: { slides: SignageSlide[]; interval: number; timeZone: string; venue: string }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % count), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [active, count, interval]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') setActive((index) => (index + 1) % count);
      if (event.key === 'ArrowLeft') setActive((index) => (index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  // A refresh can change the number of slides under us.
  const current = active < count ? active : 0;

  return (
    <main className="cnd cn-grain" aria-roledescription="carousel" aria-label={`${venue} — in the room`}>
      {slides.map((slide, index) => (
        <section
          key={slide.id}
          className="cnd-slide"
          data-active={index === current ? 'true' : 'false'}
          aria-hidden={index === current ? undefined : true}
          aria-roledescription="slide"
          aria-label={slide.label}
        >
          {slide.node}
        </section>
      ))}

      <div className="cnd-chrome" aria-hidden="true">
        <p className="cnd-mark">Cosa Nostra</p>
        <Clock timeZone={timeZone} />
      </div>

      {count > 1 ? (
        <ol className="cnd-progress" aria-hidden="true" style={{ '--cnd-interval': `${interval}s` } as React.CSSProperties}>
          {slides.map((slide, index) => (
            <li key={slide.id} data-state={index === current ? 'active' : index < current ? 'done' : 'todo'}>
              <span className="cnd-progress-label">{slide.label}</span>
              <span className="cnd-progress-bar">
                {/* Keyed to the active slide so the fill restarts on each turn. */}
                <span key={index === current ? `on-${current}` : 'off'} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}

function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <p className="cnd-clock cn-num">&nbsp;</p>;
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(now);
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(now);
  return (
    <p className="cnd-clock cn-num">
      <span>{day}</span> {time.replace(' AM', ' am').replace(' PM', ' pm')}
    </p>
  );
}
