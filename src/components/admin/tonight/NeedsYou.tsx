import Link from 'next/link';
import { FIGURE, Panel, Quiet, Section } from './parts';

/**
 * What is waiting on the owner, most pressing first.
 *
 * Every entry is somebody or something waiting on a decision, and every entry
 * goes straight to where that decision is made. Nothing is red and nothing is
 * a badge: the count is set in the same type as every other figure, and the
 * one thing that costs money tonight is marked with a word, "Now".
 */

export interface NeedsItem {
  id: string;
  /** A number set large at the start of the row, or a word when there is no count. */
  lead: number | 'Now';
  title: string;
  detail?: string;
  href: string;
}

export function NeedsYou({ items, housekeeping }: { items: NeedsItem[]; housekeeping: string | null }) {
  return (
    <Section id="needs-you" title="Needs you">
      {items.length === 0 ? (
        <Quiet title="Nothing is waiting on you.">
          <p>No enquiries, no applications, nobody asking for cover. Enjoy the quiet before service.</p>
          {housekeeping ? <HousekeepingLine text={housekeeping} /> : null}
        </Quiet>
      ) : (
        <Panel>
          <ul className="divide-y divide-brown/10">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3.5 transition-colors hover:bg-brown/4 sm:px-6"
                >
                  {item.lead === 'Now' ? (
                    <span className="justify-self-start rounded-(--radius-sm) border border-amber/50 bg-amber/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-amber">
                      Now
                    </span>
                  ) : (
                    <span className={`${FIGURE} text-[1.625rem] text-brown`}>{item.lead}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-semibold leading-snug text-brown">{item.title}</span>
                    {item.detail ? (
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-brown-soft">{item.detail}</span>
                    ) : null}
                  </span>
                  <span aria-hidden="true" className="text-brown-soft transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brown">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {housekeeping ? (
            <div className="border-t border-brown/10 px-5 py-3.5 sm:px-6">
              <HousekeepingLine text={housekeeping} />
            </div>
          ) : null}
        </Panel>
      )}
    </Section>
  );
}

/** Housekeeping stays one quiet, uncounted sentence — it is never urgent. */
function HousekeepingLine({ text }: { text: string }) {
  return (
    <p className="text-[0.8125rem] leading-relaxed text-brown-soft">
      {text}{' '}
      <Link href="/admin/tidy" className="whitespace-nowrap underline underline-offset-4 hover:text-brown">
        See the list
      </Link>
    </p>
  );
}
