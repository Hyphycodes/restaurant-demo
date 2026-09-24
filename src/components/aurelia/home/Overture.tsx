'use client';

import { useLayoutEffect, useRef } from 'react';
import { motion, motionArmed } from '../motion/engine';

const LINES = [
  'A supper club in the old sense.',
  'A long table, a proper drink, a record turning in the next room —',
  'and nobody checking the time.',
];

/**
 * A single statement, lit word by word as the guest reads down the page —
 * the way a room's candles are lit one table at a time.
 */
export function Overture() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !motionArmed()) return;
    const { gsap } = motion();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('.cn-ov-word'),
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: root.querySelector('p'), start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="cn-night cn-overture cn-section" aria-label="About Casa Aurelia">
      <div className="cn-wrap">
        <p className="cn-eyebrow">Est. for the evening</p>
        <p className="cn-display cn-overture-text">
          {LINES.map((line, index) => (
            <span key={index} className={index === 2 ? 'cn-italic cn-ov-accent' : undefined}>
              {line.split(' ').map((word, w) => (
                <span key={w} className="cn-ov-word">
                  {word}{' '}
                </span>
              ))}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
