'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { MapLinks } from '@/lib/visit';



type AppId = keyof MapLinks;

const APPS: Record<AppId, { label: string; detail: string }> = {
  apple: { label: 'Fictional location', detail: 'No physical address' },
  google: { label: 'West Loop · Chicago', detail: 'A fictional supper club' },
  waze: { label: 'Explore the restaurant', detail: 'Portfolio demo' },
};

const DEFAULT_ORDER: AppId[] = ['google', 'apple', 'waze'];
const APPLE_ORDER: AppId[] = ['apple', 'google', 'waze'];

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function DirectionsButton({
  maps,
  address,
  tone = 'light',
  className = '',
  /** `lg` matches the hero action row; `md` sits inside a card. */
  size = 'lg',
  /**
   * `solid` is the orange pill. `address` turns the address itself into the
   * control — one big target that says where you are going and opens the map
   * when you tap it, instead of a separate button beside text you cannot press.
   */
  appearance = 'solid',
  children,
}: {
  maps: MapLinks;
  /** Named in the screen-reader label, so "directions" says where to. */
  address: string;
  tone?: 'light' | 'dark';
  className?: string;
  size?: 'md' | 'lg';
  appearance?: 'solid' | 'address';
  /** The address lines, when `appearance` is `address`. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<AppId[]>(DEFAULT_ORDER);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `maxTouchPoints` is what tells an iPad running desktop Safari apart from
    // a Mac; both want Apple Maps, so either signal is enough here.
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod|Macintosh/.test(ua)) setOrder(APPLE_ORDER);
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        wrapper.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const dark = tone === 'dark';
  const trigger = dark
    ? 'bg-night-text text-obsidian hover:bg-linen'
    : 'bg-orange text-on-orange hover:bg-orange-deep';
  const padding = size === 'lg' ? 'px-7 py-3.5 text-base' : 'px-5 py-2.5 text-[0.9375rem]';

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      {appearance === 'address' ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`group block w-full rounded-(--radius-md) border px-4 py-4 text-left transition-colors duration-150 sm:px-5 ${
            dark
              ? 'border-night-text/25 bg-night-text/6 hover:border-night-text/50'
              : 'border-brown/20 bg-linen/70 hover:border-brown/45 hover:bg-linen'
          }`}
        >
          <span className={`tabular block text-[length:var(--text-body-lg)] font-semibold leading-snug ${dark ? 'text-night-text' : 'text-brown'}`}>
            {children}
          </span>
          <span
            className={`mt-3 flex items-center gap-2 border-t pt-3 text-[0.9375rem] font-semibold ${
              dark ? 'border-night-text/15 text-night-text' : 'border-brown/12 text-clay'
            }`}
          >
            <PinIcon />
            Get directions
            <Chevron open={open} />
          </span>
          <span className="sr-only">— choose a map app</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-(--radius-md) font-semibold [font-variation-settings:"wdth"_104] tracking-[0.02em] transition-colors duration-150 active:translate-y-px sm:w-auto ${trigger} ${padding}`}
        >
          <PinIcon />
          Get directions
          <Chevron open={open} />
        </button>
      )}

      {open ? (
        <div
          id={panelId}
          ref={panel}
          role="group"
          aria-label={`Open directions to ${address}`}
          // Full width under the button on a phone, a floating card from `sm`.
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-(--radius-md) border border-brown/20 bg-linen shadow-[0_18px_40px_rgba(42,18,3,0.18)] sm:right-auto sm:w-72"
        >
          <p className="border-b border-brown/12 px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-brown-soft">
            Open in
          </p>
          <ul>
            {order.map((app) => (
              <li key={app}>
                <a
                  href={maps[app]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center gap-3 border-b border-brown/10 px-4 py-2.5 text-[0.9375rem] font-medium text-brown transition-colors last:border-b-0 hover:bg-brown/6"
                >
                  <span className="text-clay">
                    <PinIcon />
                  </span>
                  <span className="min-w-0 flex-1">{APPS[app].label}</span>
                  <span aria-hidden="true" className="text-brown-soft">
                    ↗
                  </span>
                  <span className="sr-only">
                    — {APPS[app].detail} with directions to {address} (opens in a new tab)
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
