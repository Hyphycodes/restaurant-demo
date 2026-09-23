import Link from 'next/link';
import type { ReactNode } from 'react';
import { Eyebrow, FIGURE } from './parts';

/**
 * Today in four facts: the room, the night, the floor, the week.
 *
 * Each cell is a sentence broken in two — a short answer set large, and the
 * detail under it — so the strip reads left to right as "Open until 11pm.
 * Aperitivo Club, 5–8pm. Four people on. $1,548 this week." A cell with a
 * link is the way into that part of the admin.
 */

export interface HeadlineCell {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  /** A small lit dot beside the value: open, closed, or nothing. */
  signal?: 'on' | 'off';
  /** The value is a figure (money, a count): set it in lining numerals. */
  numeric?: boolean;
}

export function HeadlineStrip({ cells }: { cells: HeadlineCell[] }) {
  return (
    <section
      aria-label="Today at a glance"
      className="admin-raised grid grid-cols-2 overflow-hidden rounded-(--radius-lg) border border-brown/12 bg-linen lg:grid-cols-4"
    >
      {cells.map((cell, index) => {
        const body = (
          <>
            <Eyebrow>{cell.label}</Eyebrow>
            <p className="mt-2.5 flex min-w-0 items-center gap-2 sm:mt-3 sm:gap-2.5">
              {cell.signal ? (
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${
                    cell.signal === 'on' ? 'bg-success shadow-[0_0_0_4px_rgb(143_207_153/0.16)]' : 'bg-brown-soft/60'
                  }`}
                />
              ) : null}
              <span className={`${cell.numeric ? FIGURE : 'admin-figure'} min-w-0 truncate text-[clamp(1.25rem,2.3vw,1.875rem)] text-brown`}>{cell.value}</span>
            </p>
            {cell.detail ? <p className="tabular mt-1.5 text-[0.8125rem] leading-snug text-brown-soft sm:mt-2 sm:text-[0.875rem]">{cell.detail}</p> : null}
          </>
        );
        // Two by two on a phone, one row of four from a laptop up.
        const edge = [
          index >= 2 ? 'border-t border-brown/10 lg:border-t-0' : '',
          index % 2 === 1 ? 'border-l border-brown/10' : '',
          index === 2 ? 'lg:border-l lg:border-brown/10' : '',
        ].join(' ');
        return cell.href ? (
          <Link key={cell.label} href={cell.href} className={`block min-w-0 px-4 py-4 transition-colors hover:bg-brown/4 sm:px-6 sm:py-5 ${edge}`}>
            {body}
          </Link>
        ) : (
          <div key={cell.label} className={`min-w-0 px-4 py-4 sm:px-6 sm:py-5 ${edge}`}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
