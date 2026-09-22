'use client';

import { useEffect, useState } from 'react';

/**
 * The buy affordance that is always on screen on a phone.
 *
 * Appears once the ticket box has left the viewport and hides again whenever
 * the footer is in view, so it never sits on top of the address. Desktop keeps
 * the box in the right column and never shows this.
 */
export function StickyBuyBar({
  headline,
  action,
}: {
  headline: string;
  action: { kind: 'external'; url: string; label: string } | { kind: 'scroll'; label: string };
}) {
  const [boxVisible, setBoxVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const box = document.querySelector('[data-ticket-box]');
    const footer = document.querySelector('footer');
    if (!box || typeof IntersectionObserver === 'undefined') return;

    const boxObserver = new IntersectionObserver(
      ([entry]) => setBoxVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    );
    boxObserver.observe(box);

    let footerObserver: IntersectionObserver | null = null;
    if (footer) {
      footerObserver = new IntersectionObserver(
        ([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)),
        { threshold: 0 },
      );
      footerObserver.observe(footer);
    }
    return () => {
      boxObserver.disconnect();
      footerObserver?.disconnect();
    };
  }, []);

  const shown = !boxVisible && !footerVisible;
  const button =
    'inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-amber px-6 text-[1rem] font-semibold text-on-orange';

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-night-text/12 bg-obsidian/95 px-5 pt-3 backdrop-blur-sm transition-transform duration-200 lg:hidden ${
        shown ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
        <p className="tabular text-[1.0625rem] font-semibold text-night-text">{headline}</p>
        {action.kind === 'external' ? (
          <a href={action.url} target="_blank" rel="noopener noreferrer" className={button} tabIndex={shown ? 0 : -1}>
            {action.label}
          </a>
        ) : (
          <a href="#tickets" className={button} tabIndex={shown ? 0 : -1}>
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
