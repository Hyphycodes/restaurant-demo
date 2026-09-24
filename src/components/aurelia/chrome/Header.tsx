'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Drawer } from './Drawer';
import { aureliaPrimaryNav } from './nav';

/**
 * The header floats over every page's opening picture and becomes a bar of
 * smoked glass once the visitor starts reading. It steps out of the way on
 * the way down and returns the moment they scroll back up.
 */
export function Header({ reservationUrl, phone }: { reservationUrl: string; phone: string }) {
  const pathname = usePathname();
  const [over, setOver] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setOver(y < 48);
      setHidden(y > 420 && y > last.current + 4);
      if (y < last.current - 4 || y < 420) setHidden(false);
      last.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined);

  return (
    <>
      <header className="cn-header" data-over={over} data-hidden={hidden && !open}>
        <div className="cn-wrap cn-header-inner">
          <nav aria-label="Primary" className="cn-nav">
            {aureliaPrimaryNav.slice(0, 3).map((item) => (
              <Link key={item.href} href={item.href} aria-current={current(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="cn-wordmark" aria-label="Casa Aurelia, home">
            <span className="cn-wordmark-name">Casa Aurelia</span>
            <span className="cn-wordmark-sub">Italian Supper Club</span>
          </Link>
          <div className="cn-header-aside">
            <nav aria-label="Secondary" className="cn-nav">
              {aureliaPrimaryNav.slice(3).map((item) => (
                <Link key={item.href} href={item.href} aria-current={current(item.href)}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link href={reservationUrl} className="cn-btn">
              Reserve
            </Link>
            <button
              type="button"
              className="cn-menu-toggle"
              aria-expanded={open}
              aria-controls="cn-drawer"
              onClick={() => setOpen(true)}
            >
              <span className="sr-only sm:not-sr-only">Menu</span>
              <span className="cn-menu-toggle-bars" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)} reservationUrl={reservationUrl} phone={phone} />
    </>
  );
}
