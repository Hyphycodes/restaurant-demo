'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { motion, reducedMotion } from './engine';

/**
 * Lenis drives the page's scroll so pinned and scrubbed sequences stay in
 * step with the wheel. GSAP's ticker is the single clock for both.
 *
 * Off under reduced motion and on touch-first devices, where the native
 * scroll is already the best one there is.
 */
export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const { gsap, ScrollTrigger } = motion();
    if (reducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;

    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, anchors: { offset: -96 } });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('cn-lenis');

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove('cn-lenis');
    };
  }, []);

  // A new route starts at the top, with triggers measured against its layout.
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
    const { ScrollTrigger } = motion();
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
