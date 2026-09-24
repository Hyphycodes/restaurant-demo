'use client';

import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';
import { motion, motionArmed, settle } from './engine';

/**
 * Declarative scroll choreography for server-rendered sections.
 *
 * Children opt in with data attributes, so a page stays a server component
 * and only this wrapper ships to the browser:
 *
 *   data-m="title"     opening-title lines rising out of a mask
 *   data-m="up"        a quiet rise
 *   data-m="stagger"   its direct children rise one after another
 *   data-m="image"     a photograph brought up out of darkness
 *   data-m="line"      a rule drawn from the left
 *   data-m="parallax"  drifts against the scroll; data-speed (default 0.15)
 *
 *   data-delay         seconds, for anything above
 *   data-now           plays on load instead of on scroll (above the fold)
 */
export function MotionScope({
  as: Tag = 'div',
  className,
  children,
  id,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionArmed()) {
      settle(root);
      return;
    }
    const { gsap, SplitText } = motion();
    const splits: InstanceType<typeof SplitText>[] = [];

    const ctx = gsap.context(() => {
      const trigger = (node: Element) =>
        (node as HTMLElement).dataset.now !== undefined
          ? undefined
          : { trigger: node, start: 'top 88%', once: true };
      const delay = (node: Element) => Number((node as HTMLElement).dataset.delay ?? 0);

      root.querySelectorAll<HTMLElement>('[data-m="title"]').forEach((node) => {
        gsap.set(node, { visibility: 'visible' });
        // autoSplit re-measures once the display face has loaded and on
        // resize, so the masked lines always match the lines on screen.
        const split = SplitText.create(node, {
          type: 'lines,words',
          mask: 'lines',
          linesClass: 'cn-line',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, {
              yPercent: 115,
              rotate: 2.5,
              duration: 1.35,
              stagger: 0.045,
              delay: delay(node),
              scrollTrigger: trigger(node),
            }),
        });
        splits.push(split);
      });

      root.querySelectorAll<HTMLElement>('[data-m="up"]').forEach((node) => {
        gsap.fromTo(node, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 1.2, delay: delay(node), scrollTrigger: trigger(node) });
      });

      root.querySelectorAll<HTMLElement>('[data-m="stagger"]').forEach((node) => {
        gsap.set(node, { visibility: 'visible' });
        gsap.fromTo(
          node.children,
          { autoAlpha: 0, y: 30 },
          { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, delay: delay(node), scrollTrigger: trigger(node) },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-m="image"]').forEach((node) => {
        const inner = node.querySelector('img, video') ?? node.firstElementChild;
        gsap.set(node, { visibility: 'visible' });
        const tl = gsap.timeline({ delay: delay(node), scrollTrigger: trigger(node) });
        tl.fromTo(
          node,
          { clipPath: 'inset(18% 10% 18% 10%)', filter: 'brightness(0.05)' },
          { clipPath: 'inset(0% 0% 0% 0%)', filter: 'brightness(1)', duration: 1.8, ease: 'expo.inOut', clearProps: 'filter' },
        );
        if (inner) tl.fromTo(inner, { scale: 1.28 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0);
      });

      root.querySelectorAll<HTMLElement>('[data-m="line"]').forEach((node) => {
        gsap.fromTo(
          node,
          { autoAlpha: 1, scaleX: 0, transformOrigin: '0% 50%' },
          { scaleX: 1, duration: 1.6, ease: 'expo.inOut', delay: delay(node), scrollTrigger: trigger(node) },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-m="parallax"]').forEach((node) => {
        const speed = Number(node.dataset.speed ?? 0.15);
        gsap.set(node, { visibility: 'visible' });
        gsap.fromTo(
          node,
          { yPercent: -speed * 50 },
          {
            yPercent: speed * 50,
            ease: 'none',
            scrollTrigger: { trigger: node.parentElement ?? node, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
    }, root);

    return () => {
      ctx.revert();
      splits.forEach((split) => split.revert());
    };
  }, []);

  return (
    <Tag ref={ref} className={className} id={id} {...rest}>
      {children}
    </Tag>
  );
}
