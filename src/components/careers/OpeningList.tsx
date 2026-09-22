import Link from 'next/link';
import { employmentLabel, type JobOpening } from '@/content/careers';

/**
 * What is open right now.
 *
 * One row per opening: the job, a sentence if somebody wrote one, whether it
 * is full or part-time, and a button that takes you to the form with that
 * role already chosen. No salary band, no "competitive pay", no requirements
 * list — none of that is published anywhere, and inventing it is how a
 * careers page starts lying.
 *
 * `Apply` is a link with the role in the query string rather than a button
 * that needs JavaScript, so it works on a page that has not hydrated yet and
 * the back button behaves.
 */
export function OpeningList({
  openings,
  /** Where Apply goes. `/careers` on the careers page itself. */
  applyBase = '/careers',
  /** Show at most this many, with a line saying how many are left. */
  limit,
}: {
  openings: JobOpening[];
  applyBase?: string;
  limit?: number;
}) {
  const shown = typeof limit === 'number' ? openings.slice(0, limit) : openings;
  const hidden = openings.length - shown.length;

  return (
    <>
      <ul className="grid gap-3">
        {shown.map((opening) => (
          <li key={opening.id}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-(--radius-md) border border-brown/20 bg-linen px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="display text-[1.25rem] leading-none text-brown">
                    {opening.title}
                  </span>
                  <span className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-clay">
                    {employmentLabel(opening.employmentType)}
                  </span>
                </p>
                {opening.summary ? (
                  <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-brown-soft">
                    {opening.summary}
                  </p>
                ) : null}
              </div>
              <Link
                href={`${applyBase}?role=${encodeURIComponent(opening.id)}#apply`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-orange px-6 text-[0.9375rem] font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-orange-deep sm:w-auto"
              >
                Apply
                <span className="sr-only"> for {opening.title}</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <p className="mt-4 text-[0.9375rem] text-brown-soft">
          {hidden === 1 ? 'One more role is open.' : `${hidden} more roles are open.`}{' '}
          <Link href="/careers" className="font-semibold text-brown underline underline-offset-4 hover:text-clay">
            See them all
          </Link>
        </p>
      ) : null}
    </>
  );
}
