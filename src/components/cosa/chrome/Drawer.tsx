'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, motionArmed } from '../motion/engine';
import { cosaDrawerNav, cosaHouseNav } from './nav';

const FOCUSABLE = 'a[href], button:not([disabled])';

export function Drawer({
  open,
  onClose,
  reservationUrl,
  phone,
}: {
  open: boolean;
  onClose: () => void;
  reservationUrl: string;
  phone: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLElement>('button')?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !ref.current || !motionArmed()) return;
    const { gsap } = motion();
    const ctx = gsap.context(() => {
      gsap.from(ref.current, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' });
      gsap.from('li', { yPercent: 60, autoAlpha: 0, stagger: 0.05, duration: 1, delay: 0.3 });
    }, ref);
    return () => ctx.revert();
  }, [open]);

  return (
    <div
      id="cn-drawer"
      ref={ref}
      className="cn-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      hidden={!open}
    >
      <div className="cn-drawer-top">
        <span className="cn-wordmark">
          <span className="cn-wordmark-name">Cosa Nostra</span>
          <span className="cn-wordmark-sub">Italian Supper Club</span>
        </span>
        <button type="button" className="cn-menu-toggle" style={{ display: 'inline-flex' }} onClick={onClose}>
          Close <span aria-hidden="true">✕</span>
        </button>
      </div>
      <nav aria-label="Site">
        <ol>
          {cosaDrawerNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined} onClick={onClose}>
                {item.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <div className="cn-drawer-foot">
        <Link href={reservationUrl} className="cn-btn" onClick={onClose}>
          Find your table <span className="cn-arrow" aria-hidden="true">→</span>
        </Link>
        <div className="cn-drawer-small">
          {cosaHouseNav.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose}>
              {item.label}
            </Link>
          ))}
          <span>{phone}</span>
        </div>
      </div>
    </div>
  );
}
