'use client';

import { useEffect, useState } from 'react';

/**
 * The one thing that moves on the home screen: a number counting up on load.
 * Tabular figures so the layout never shifts, and no motion at all when the
 * reader has asked for less.
 */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || value === 0) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular admin-countup">{format ? format(shown) : shown}</span>;
}
