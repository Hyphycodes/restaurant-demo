import Link from 'next/link';
import type { Announcement } from '@/content/types';

/**
 * Announcement bar.
 *
 * Content is structured and scheduled, and lives in the CMS — never hard-coded
 * inside the header. Ships disabled: the restaurant references a "$1 Taco Deal"
 * and a lunch deal but publishes terms for neither, so the bar renders nothing
 * rather than an invented offer. See docs/CONTENT-QUESTIONS.md §12.
 */
export function AnnouncementBar({ announcement }: { announcement: Announcement | null }) {
  if (!announcement || !announcement.enabled) return null;

  const dark = announcement.tone === 'night';

  return (
    <div
      className={
        dark ? 'bg-espresso text-night-text on-dark' : 'bg-orange text-on-orange'
      }
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center text-[0.8125rem] font-medium">
        <span>{announcement.message}</span>
        {announcement.href && announcement.linkLabel ? (
          <Link
            href={announcement.href}
            className="underline underline-offset-4 transition-[text-underline-offset] hover:underline-offset-[6px]"
          >
            {announcement.linkLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Picks the first enabled announcement that is currently in its window. */
export function activeAnnouncement(list: Announcement[], now: Date): Announcement | null {
  return (
    list.find((a) => {
      if (!a.enabled) return false;
      if (a.startsAt && new Date(a.startsAt) > now) return false;
      if (a.endsAt && new Date(a.endsAt) < now) return false;
      return true;
    }) ?? null
  );
}
