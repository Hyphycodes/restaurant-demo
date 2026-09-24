'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, motionArmed, settle } from '../motion/engine';

/**
 * Event posters arrive like flyers pasted up on a wall at closing time:
 * each slides in on its own angle and settles, slightly crooked.
 */
export function NightsDirector({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionArmed()) {
      settle(root);
      return;
    }
    const { gsap } = motion();
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      gsap.set(q('[data-m]'), { visibility: 'visible' });
      const posters = gsap.utils.toArray<HTMLElement>(q('.cn-flyer'));
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.cn-flyers')[0], start: 'top 80%', end: 'center 45%', scrub: 1 } });
      posters.forEach((poster, index) => {
        const tilt = Number(poster.dataset.tilt ?? 0);
        tl.fromTo(
          poster,
          { xPercent: 60 + index * 25, yPercent: 30, rotate: tilt + 14, autoAlpha: 0 },
          { xPercent: 0, yPercent: 0, rotate: tilt, autoAlpha: 1, ease: 'power3.out', duration: 1 },
          index * 0.22,
        );
      });
      gsap.from(q('.cn-nights-head > *'), {
        autoAlpha: 0,
        y: 30,
        stagger: 0.1,
        scrollTrigger: { trigger: root, start: 'top 75%', once: true },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="cn-wine-room cn-grain cn-nights cn-section" aria-labelledby="nights-title">
      {children}
    </section>
  );
}
