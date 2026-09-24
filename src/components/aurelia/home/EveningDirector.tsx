'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, motionArmed, settle } from '../motion/engine';

/**
 * The evening, as one continuous horizontal move.
 *
 * On a wide screen the section pins and the four hours of the night slide
 * past; the clock turns, and the light in the room shifts from dusk amber to
 * wine to the last candle. On a phone the same chapters stack, each brought
 * up from dark as it arrives — a horizontal pin on a small screen fights the
 * thumb.
 */
export function EveningDirector({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionArmed()) {
      settle(root);
      return;
    }
    const { gsap } = motion();
    const mm = gsap.matchMedia();
    const q = gsap.utils.selector(root);
    gsap.set(q('[data-m]'), { visibility: 'visible' });

    mm.add('(min-width: 900px)', () => {
      const track = root.querySelector<HTMLElement>('.cn-ev-track');
      if (!track) return;
      const chapters = gsap.utils.toArray<HTMLElement>(q('.cn-ev-chapter'));
      const distance = () => track.scrollWidth - window.innerWidth;

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${distance() + window.innerHeight * 0.6}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      tl.to(track, { x: () => -distance(), duration: 1 }, 0)
        .fromTo(q('.cn-ev-hand-hour'), { rotation: 150, svgOrigin: '50 50' }, { rotation: 352, svgOrigin: '50 50', duration: 1 }, 0)
        .fromTo(q('.cn-ev-hand-minute'), { rotation: 0, svgOrigin: '50 50' }, { rotation: 2430, svgOrigin: '50 50', duration: 1 }, 0)
        .to(root, { '--ev-light': 1, duration: 1 }, 0)
        .to(q('.cn-ev-progress i'), { scaleX: 1, duration: 1 }, 0);

      chapters.forEach((chapter, index) => {
        const img = chapter.querySelector('.cn-ev-photo');
        if (img) {
          tl.fromTo(img, { xPercent: 10 }, { xPercent: -10, duration: 1 / chapters.length + 0.2 }, Math.max(0, (index - 0.6) / chapters.length));
        }
      });

      const times = gsap.utils.toArray<HTMLElement>(q('.cn-ev-time-label'));
      times.forEach((label, index) => {
        const at = index / times.length;
        tl.fromTo(label, { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, duration: 0.04 }, Math.max(0, at - 0.02));
        if (index < times.length - 1) tl.to(label, { autoAlpha: 0, yPercent: -60, duration: 0.04 }, (index + 1) / times.length - 0.03);
      });
    });

    mm.add('(max-width: 899px)', () => {
      gsap.utils.toArray<HTMLElement>(q('.cn-ev-chapter')).forEach((chapter) => {
        const photo = chapter.querySelector('.cn-ev-photo');
        gsap.from(chapter.querySelectorAll('.cn-ev-copy > *'), {
          autoAlpha: 0,
          y: 28,
          stagger: 0.08,
          scrollTrigger: { trigger: chapter, start: 'top 75%', once: true },
        });
        if (photo)
          gsap.fromTo(
            photo,
            { clipPath: 'inset(20% 12% 20% 12%)', filter: 'brightness(0.1)' },
            { clipPath: 'inset(0% 0% 0% 0%)', filter: 'brightness(1)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: chapter, start: 'top 80%', once: true } },
          );
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={ref} className="cn-evening cn-grain" aria-labelledby="evening-title">
      {children}
    </section>
  );
}
