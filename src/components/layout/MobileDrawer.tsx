'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { primaryNav, secondaryNav } from './nav';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MobileDrawer({
  reservationUrl,
  orderUrl,
}: {
  reservationUrl: string;
  orderUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Route change closes the drawer — otherwise back/forward strands it open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  
  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="absolute inset-0 h-full w-full bg-plum/80"
            />
            <div
              id="mobile-drawer"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="absolute inset-y-0 right-0 flex h-full w-full max-w-sm flex-col overflow-y-auto overscroll-contain bg-ivory"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-brown/15 px-5 py-4">
                <span className="eyebrow text-brown-soft">Menu</span>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex size-11 items-center justify-center rounded-(--radius-md) text-brown"
                >
                  <span className="sr-only">Close menu</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {/* A single flat list. No nested accordions and no duplicated
                  labels — the previous drawer showed "Catering" as a heading
                  and then "Catering" again as its own child. */}
              <nav className="flex-1 px-5 py-5" aria-label="Primary">
                <ul>
                  {primaryNav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="display flex min-h-12 items-center border-b border-brown/12 text-[1.5rem] text-brown"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  {secondaryNav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex min-h-12 items-center border-b border-brown/12 text-[0.9375rem] text-brown-soft"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="grid shrink-0 gap-2 border-t border-brown/15 px-5 py-5">
                <a
                  href={reservationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-orange px-5 font-semibold text-on-orange"
                >
                  Reserve a table
                  <span className="sr-only">(opens Demo ordering in a new tab)</span>
                </a>
                <a
                  href={orderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) border-2 border-brown px-5 font-semibold text-brown"
                >
                  Order online
                  <span className="sr-only">(opens Demo ordering in a new tab)</span>
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        className="inline-flex size-11 items-center justify-center rounded-(--radius-md) text-brown lg:hidden"
      >
        <span className="sr-only">Open menu</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
        </svg>
      </button>
      {drawer}
    </>
  );
}
