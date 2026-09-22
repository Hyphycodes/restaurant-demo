import Link from 'next/link';
import { CATEGORY_FILTERS, CATEGORY_LABEL } from '@/content/event-presentation';
import type { CategoryFilter } from '@/lib/event-calendar';

/**
 * The kind-of-night filter.
 *
 * Plain links, not a JavaScript widget. Filtering is a navigation — the result
 * is a different set of events, and it deserves a URL somebody can send to a
 * friend. It also means the filter works before, during and after hydration,
 * and costs the page no JavaScript at all.
 *
 * A filter that would show nothing is not offered. An empty result set is a
 * dead end a guest has to back out of, and we know in advance that it is empty.
 */
export function EventFilters({
  active,
  counts,
}: {
  active: CategoryFilter;
  counts: Record<CategoryFilter, number>;
}) {
  const available = CATEGORY_FILTERS.filter((category) => (counts[category] ?? 0) > 0);
  // One kind of night on the calendar is not a choice worth presenting.
  if (available.length < 2) return null;

  const chips: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All events' },
    ...available.map((category) => ({ value: category, label: CATEGORY_LABEL[category] })),
  ];

  return (
    <nav aria-label="Filter events by kind" className="mt-6">
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isActive = chip.value === active;
          return (
            <li key={chip.value}>
              <Link
                href={chip.value === 'all' ? '/events' : `/events?kind=${chip.value}`}
                scroll={false}
                aria-current={isActive ? 'true' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border px-4 text-[0.9375rem] font-semibold transition-colors ${
                  isActive
                    ? 'border-coral bg-coral text-on-orange'
                    : 'border-brown/25 text-brown hover:border-coral hover:text-coral-deep'
                }`}
              >
                {chip.label}
                <span className={`tabular text-[0.8125rem] ${isActive ? 'text-on-orange/80' : 'text-brown-soft'}`}>
                  {counts[chip.value] ?? 0}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
