'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

/**
 * A panel over the week.
 *
 * Editing a shift should not cost you the board you were reading — you are
 * usually fixing one cell because of what the cell next to it says. So the
 * editor slides over it: a sheet from the bottom on a phone, a panel from
 * the right on a laptop, and the week still visible behind.
 *
 * Open and closed are URL states, not component state, so the back button
 * closes it and a link to a shift opens it.
 */
export function Drawer({ title, eyebrow, closeHref, children }: { title: string; eyebrow?: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.push(closeHref);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [router, closeHref]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <Link href={closeHref} aria-label="Close" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="staff-drawer relative flex max-h-[92dvh] w-full flex-col overflow-y-auto border-t border-brown/20 bg-linen sm:max-h-none sm:w-[34rem] sm:border-l sm:border-t-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-brown/12 bg-linen px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">{eyebrow}</p> : null}
            <h2 className="display text-[1.375rem] leading-tight text-brown">{title}</h2>
          </div>
          <Link href={closeHref} className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[1.25rem] text-brown-soft hover:bg-brown/10 hover:text-brown">
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close</span>
          </Link>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Sends the drawer away once the form inside it has saved. */
export function CloseOnSave({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.push(href);
    router.refresh();
  }, [router, href]);
  return null;
}
