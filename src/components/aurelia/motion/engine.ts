'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

let registered = false;

/** GSAP with the plugins this site uses, registered once per page load. */
export function motion() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    gsap.defaults({ ease: 'expo.out', duration: 1.1 });
    registered = true;
    (window as Window & { __cnMotion?: boolean }).__cnMotion = true;
  }
  return { gsap, ScrollTrigger, SplitText };
}

export function reducedMotion(): boolean {
  return typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Motion runs only when the boot script armed it. The boot script and this
 * check read the same media query, so an element is never hidden by CSS and
 * then left unanimated.
 */
export function motionArmed(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('cn-js') && !reducedMotion();
}

/** Makes every [data-m] inside a root visible, for the no-motion path. */
export function settle(root: Element) {
  root.querySelectorAll<HTMLElement>('[data-m]').forEach((node) => {
    node.style.visibility = 'visible';
  });
}
