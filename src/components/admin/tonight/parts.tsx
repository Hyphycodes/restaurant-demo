import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The few shapes the Tonight screen is built from. They sit on the admin's
 * own primitives (same panel, same hairlines, same type) and only add the
 * one thing that screen needs: a quiet section heading with a way in.
 */

/**
 * Figures on this screen are set in the site's Bodoni, not the admin's
 * display face: its lining numerals keep a "1" from reading as an "I" at a
 * glance, and tabular widths keep columns of money aligned. A small optical
 * size keeps the hairlines from vanishing at display sizes on a dark field.
 */
export const FIGURE =
  "[font-family:var(--cn-serif)] [font-optical-sizing:none] [font-variation-settings:'opsz'_14] font-normal leading-[0.95] tracking-[-0.01em] tabular-nums lining-nums";

export function Section({
  id,
  title,
  link,
  children,
  className = '',
}: {
  id: string;
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="display text-[1.5rem] leading-none text-brown">
          {title}
        </h2>
        {link ? <ArrowLink href={link.href}>{link.label}</ArrowLink> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-10 items-center gap-1.5 text-[0.875rem] font-semibold text-brown-soft transition-colors hover:text-brown"
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`admin-raised rounded-(--radius-lg) border border-brown/12 bg-linen ${className}`}>{children}</div>
  );
}

/** An empty state written as a sentence, not a grey box that says "No data". */
export function Quiet({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-(--radius-md) border border-dashed border-brown/20 px-5 py-6">
      <p className="text-[1rem] font-semibold text-brown">{title}</p>
      {children ? <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-brown-soft">{children}</div> : null}
    </div>
  );
}

/** Small uppercase label, the one voice every stat on the screen shares. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brown-soft ${className}`}>{children}</p>
  );
}
