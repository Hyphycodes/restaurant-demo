'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * One-shot reveal, fired at 15% intersection.
 *
 * Two safety properties matter more than the animation:
 *  1. Under `prefers-reduced-motion` the CSS in globals.css already resolves
 *     `.reveal` to its final state, so nothing can be stranded invisible.
 *  2. If IntersectionObserver is unavailable, the element is shown immediately.
 *
 * Budget: at most four of these per viewport. See docs/DESIGN-DIRECTION.md §4.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-shown={shown ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
