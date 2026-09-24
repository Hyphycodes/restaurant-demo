'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, motionArmed, settle } from '../motion/engine';

/**
 * Opening titles.
 *
 * The room comes up out of black the way a projector warms, the candles
 * catch, and the two lines arrive like a film's title card. Then, as the
 * guest scrolls, the room slowly pushes in and the title lifts away — the
 * evening has started.
 */
export function HeroDirector({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionArmed()) {
      settle(root);
      return;
    }
    const { gsap, SplitText } = motion();
    let split: InstanceType<typeof SplitText> | null = null;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      gsap.set(q('[data-m]'), { visibility: 'visible' });

      split = SplitText.create(q('.cn-hero-title .cn-hero-line'), { type: 'words,chars', mask: 'words' });

      const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
      intro
        .fromTo(q('.cn-hero-media'), { filter: 'brightness(0)', scale: 1.22 }, { filter: 'brightness(1)', scale: 1.06, duration: 3.6, ease: 'power2.out' }, 0)
        .fromTo(q('.cn-candles'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4, ease: 'power1.inOut' }, 0.9)
        .from(q('.cn-hero-kicker'), { autoAlpha: 0, letterSpacing: '0.6em', duration: 2 }, 0.5)
        .from(split.chars, { yPercent: 118, duration: 1.5, stagger: 0.028 }, 0.8)
        .from(q('.cn-hero-rule'), { scaleX: 0, transformOrigin: '0 50%', duration: 1.6, ease: 'expo.inOut' }, 1.5)
        .from(q('.cn-hero-foot > *'), { autoAlpha: 0, y: 24, stagger: 0.12, duration: 1.3 }, 1.9)
        .from(q('.cn-hero-cue'), { autoAlpha: 0, duration: 1.2 }, 2.6);

      // The push-in, scrubbed to the first screen of scroll.
      const scroll = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
      });
      scroll
        .to(q('.cn-hero-media-inner'), { scale: 1.14, yPercent: 8, ease: 'none' }, 0)
        .to(q('.cn-hero-title'), { yPercent: -28, autoAlpha: 0.1, ease: 'none' }, 0)
        .to(q('.cn-hero-dusk'), { opacity: 1, ease: 'none' }, 0)
        .to(q('.cn-hero-foot, .cn-hero-kicker, .cn-hero-cue'), { autoAlpha: 0, ease: 'none', duration: 0.5 }, 0);
    }, root);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, []);

  return (
    <section ref={ref} className="cn-hero cn-grain" data-hero aria-labelledby="hero-title">
      {children}
    </section>
  );
}
