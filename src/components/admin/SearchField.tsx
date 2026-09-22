'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A search box that searches while you type.
 *
 * The admin's search boxes used to be plain GET forms: type, then find and press
 * "Search", then wait for the whole page. That is how a filing cabinet works,
 * not how the website this replaces works, and the button is the step people
 * miss — they type "queso", see the same list, and conclude the search is
 * broken.
 *
 * It stays a real form around a real input, so it still works with JavaScript
 * off; the button simply stops being needed once the typing is live, and takes
 * itself out of the tab order rather than sitting there as a second way to do
 * what already happened. Navigation goes through the router rather than a form
 * submit, so the page does not reload and the cursor stays in the box.
 */
export function SearchField({
  id,
  name,
  label,
  placeholder,
  initial,
  /** The path to search within, with any other filters already applied. */
  basePath,
  /** Filters to keep as you type, e.g. which menu is open. */
  keep = {},
  submitLabel = 'Search',
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  initial: string;
  basePath: string;
  keep?: Record<string, string | undefined>;
  submitLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only once mounted: until then there is no router to navigate with, and the
  // button is the only thing that works.
  useEffect(() => setLive(true), []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const search = (next: string) => {
    setValue(next);
    if (!live) return;
    if (timer.current) clearTimeout(timer.current);
    // Long enough that a word typed at speed is one navigation, short enough
    // that the list has moved by the time you look up from the keyboard.
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [key, entry] of Object.entries(keep)) {
        if (entry) params.set(key, entry);
      }
      if (next.trim()) params.set(name, next.trim());
      const query = params.toString();
      startTransition(() => router.replace(query ? `${basePath}?${query}` : basePath));
    }, 280);
  };

  return (
    <div className="flex min-w-48 flex-1 items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[0.8125rem] font-semibold text-brown">
          {label}
        </label>
        <div className="relative mt-1.5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-soft"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="size-4"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </span>
          <input
            id={id}
            name={name}
            type="search"
            value={value}
            onChange={(event) => search(event.target.value)}
            placeholder={placeholder}
            className="min-h-11 w-full rounded-full border border-brown/25 bg-linen pl-9 pr-9 text-[0.9375rem] text-brown transition-colors placeholder:text-brown-soft/60 hover:border-brown/40"
          />
          {pending ? (
            <span
              aria-hidden="true"
              className="admin-spin absolute right-3 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-transparent border-t-clay"
            />
          ) : null}
        </div>
      </div>

      {/* Without JavaScript this is how a search happens. With it, the typing
          already did the work. */}
      <button
        type="submit"
        tabIndex={live ? -1 : undefined}
        aria-hidden={live}
        // The display utility is chosen rather than stacked: `hidden` and
        // `inline-flex` are both display rules in the same layer, and which one
        // wins is decided by Tailwind's output order, not by the order they are
        // written here.
        className={`${
          live ? 'hidden' : 'inline-flex'
        } min-h-11 shrink-0 items-center rounded-full border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown`}
      >
        {submitLabel}
      </button>
    </div>
  );
}
