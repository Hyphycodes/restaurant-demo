'use client';

import { useEffect, useState } from 'react';

/**
 * The dark-doorway problem.
 *
 * A phone on auto-brightness in a dim room dims itself to about the worst
 * surface a scanner can read. The web cannot set screen brightness, so the
 * honest thing is to say so once, quietly, and only while the ticket is on
 * screen — and to keep the screen from sleeping while it is, which the web
 * CAN do.
 */
export function Brightness() {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        if (!wakeLock) return;
        lock = await wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          lock = null;
          return;
        }
        setHeld(true);
      } catch {
        // Denied, unsupported, or the tab is not visible. The note below still
        // stands on its own.
      }
    };

    void request();
    // iOS drops the lock whenever the tab is backgrounded; take it again.
    const revive = () => {
      if (document.visibilityState === 'visible' && !lock) void request();
    };
    document.addEventListener('visibilitychange', revive);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', revive);
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <p className="mt-4 text-[0.875rem] leading-relaxed text-night-soft">
      Turn your screen brightness up before you reach the door — a dim screen is the one thing
      scanners struggle with.
      {held ? ' Your screen will stay awake while this page is open.' : ''}
    </p>
  );
}
