'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, motionArmed, settle } from '../motion/engine';

/**
 * BEHIND THE HOSPITALITY — the portfolio moment.
 *
 * The public site shrinks to a screen, splits along a seam of candle light
 * and parts like a pair of doors. Underneath, the operating room assembles
 * out of the dark: tonight's numbers, events, the content studio, the rota,
 * the staff app, checklists, training, the private-events pipeline — each
 * wired back to the centre. Then one line: one restaurant, one system.
 *
 * Pinned and scrubbed on wide screens so it can be recorded as footage.
 * On phones it plays as a shorter, unpinned sequence.
 */
export function BehindDirector({ children, id }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionArmed()) {
      settle(root);
      return;
    }
    const { gsap } = motion();
    const q = gsap.utils.selector(root);
    gsap.set(q('[data-m]'), { visibility: 'visible' });
    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px) and (min-height: 620px)', () => {
      const panels = gsap.utils.toArray<HTMLElement>(q('.cn-ui'));
      const wires = gsap.utils.toArray<SVGPathElement>(q('.cn-bh-wires path'));
      wires.forEach((wire) => {
        const length = wire.getTotalLength();
        gsap.set(wire, { strokeDasharray: length, strokeDashoffset: length });
      });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: '+=320%',
          pin: q('.cn-bh-stage')[0],
          scrub: 1,
          anticipatePin: 1,
        },
      });

      tl.set(q('.cn-bh-os'), { autoAlpha: 1 })
        // 1 — the website becomes a screen
        .to(q('.cn-bh-site'), { scale: 0.78, borderRadius: 18, duration: 1 }, 0)
        .to(q('.cn-bh-intro'), { autoAlpha: 0, y: -40, duration: 0.6 }, 0.2)
        .fromTo(q('.cn-bh-cap-1'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.5)
        // 2 — a seam of light, then the doors part
        .fromTo(q('.cn-bh-seam'), { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.5 }, 1.0)
        .to(q('.cn-bh-cap-1'), { autoAlpha: 0, duration: 0.3 }, 1.3)
        .to(q('.cn-bh-half-top'), { yPercent: -112, rotateX: 18, duration: 1.4, ease: 'power2.in' }, 1.45)
        .to(q('.cn-bh-half-bottom'), { yPercent: 112, rotateX: -18, duration: 1.4, ease: 'power2.in' }, 1.45)
        .to(q('.cn-bh-seam'), { autoAlpha: 0, duration: 0.4 }, 1.75)
        .fromTo(q('.cn-bh-os'), { scale: 0.86, filter: 'brightness(0.2)' }, { scale: 1, filter: 'brightness(1)', duration: 1.6, ease: 'power2.out' }, 1.5)
        // 3 — the operating room assembles
        .fromTo(
          panels,
          { autoAlpha: 0, z: -600, y: 80, rotateX: 14, filter: 'blur(10px)' },
          { autoAlpha: 1, z: 0, y: 0, rotateX: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.16, ease: 'power3.out' },
          1.7,
        )
        .to(wires, { strokeDashoffset: 0, duration: 1.2, stagger: 0.08 }, 2.4)
        .fromTo(q('.cn-bh-core'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 2.5)
        .fromTo(q('.cn-bh-cap-2'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 2.6)
        // 4 — one line
        .to(q('.cn-bh-cap-2'), { autoAlpha: 0, duration: 0.4 }, 3.9)
        .to(panels, { autoAlpha: 0.22, filter: 'blur(2px)', duration: 0.8, stagger: 0.02 }, 4.0)
        .to(q('.cn-bh-wires, .cn-bh-core'), { autoAlpha: 0.2, duration: 0.8 }, 4.0)
        .fromTo(q('.cn-bh-finale'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 4.25)
        .to({}, { duration: 0.6 });
    });

    mm.add('(max-width: 899px), (max-height: 619px)', () => {
      gsap.fromTo(
        q('.cn-bh-half-top'),
        { yPercent: 0 },
        { yPercent: -18, ease: 'none', scrollTrigger: { trigger: q('.cn-bh-site')[0], start: 'top 60%', end: 'bottom top', scrub: true } },
      );
      gsap.fromTo(
        q('.cn-bh-half-bottom'),
        { yPercent: 0 },
        { yPercent: 18, ease: 'none', scrollTrigger: { trigger: q('.cn-bh-site')[0], start: 'top 60%', end: 'bottom top', scrub: true } },
      );
      gsap.utils.toArray<HTMLElement>(q('.cn-ui')).forEach((panel) => {
        gsap.from(panel, { autoAlpha: 0, y: 40, scale: 0.96, duration: 1, scrollTrigger: { trigger: panel, start: 'top 88%', once: true } });
      });
      gsap.from(q('.cn-bh-finale > *'), { autoAlpha: 0, y: 30, stagger: 0.1, scrollTrigger: { trigger: q('.cn-bh-finale')[0], start: 'top 80%', once: true } });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={ref} id={id} className="cn-behind" aria-labelledby="behind-title">
      {children}
    </section>
  );
}
