import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CareersPage from '@/app/(site)/careers/page';
import CateringPage from '@/app/(site)/catering/page';
import EventsPage from '@/app/(site)/events/page';
import MenuPage from '@/app/(site)/menu/page';
import HomePage from '@/app/(site)/page';
import ContactPage from '@/app/(site)/contact/page';
import PrivateEventsPage from '@/app/(site)/private-events/page';
import TalentPage from '@/app/(site)/talent/page';
import VisitPage from '@/app/(site)/visit/page';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { getReadDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { getThemeRecord } from '@/server/content/theme';
import { canOpen } from '@/server/permissions';
import { isSeasonalSlug, THEMES } from '@/themes/registry';
import { DEFAULT_RESOLVED, resolveTheme, setThemeOverride } from '@/themes/resolve';
import '@/themes/autumn-evening/theme.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Theme preview — Casa Aurelia Admin',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The real public pages, rendered with a theme forced on, for staff only.
 *
 * This is a separate dynamic route rather than a query parameter on the public
 * site because the public pages are statically cached; reading a preview flag
 * there would make every visitor's request dynamic. Here nothing is cached and
 * nobody but staff can reach it.
 */
const PAGES: { key: string; label: string; Page: () => Promise<React.ReactNode> }[] = [
  { key: '', label: 'Home', Page: HomePage },
  { key: 'menu', label: 'Menu', Page: MenuPage },
  // Events reads searchParams; the preview has none, so it previews unfiltered.
  { key: 'events', label: 'Events', Page: () => EventsPage({ searchParams: Promise.resolve({}) }) },
  { key: 'catering', label: 'Catering', Page: CateringPage },
  { key: 'private-events', label: 'Private events', Page: PrivateEventsPage },
  { key: 'visit', label: 'Visit', Page: VisitPage },
  { key: 'contact', label: 'Contact', Page: ContactPage },
  // Careers reads searchParams to preselect a role; the preview has none.
  { key: 'careers', label: 'Work at Casa Aurelia', Page: () => CareersPage({ searchParams: Promise.resolve({}) }) },
  { key: 'talent', label: 'Create with Casa Aurelia', Page: TalentPage },
];

export default async function ThemePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'website')) notFound();

  const [{ path = [] }, { theme: requested }] = await Promise.all([params, searchParams]);
  const entry = PAGES.find((page) => page.key === path.join('/'));
  if (!entry) notFound();

  const slug = requested ?? 'autumn-evening';
  let theme = DEFAULT_RESOLVED;
  if (isSeasonalSlug(slug)) {
    const db = getReadDb();
    const record = db ? await getThemeRecord(db, slug) : null;
    theme = await resolveTheme(slug, record?.config, 'preview');
  } else if (slug !== 'default') {
    notFound();
  }
  // Every component below asks getActiveTheme(); for this request the answer
  // is the one being previewed.
  setThemeOverride(theme);

  const name = theme.definition?.name ?? 'Default Casa Aurelia';
  const { Page } = entry;

  return (
    <>
      <SiteChrome theme={theme}>
        <Page />
      </SiteChrome>

      <div
        role="region"
        aria-label="Theme preview"
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-amber/40 bg-teal text-linen shadow-[0_-10px_30px_rgba(0,0,0,0.35)]"
      >
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-[0.8125rem] sm:px-6">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span aria-hidden="true" className="size-2 rounded-full bg-amber" />
            Previewing {name}
            <span className="font-normal text-linen/60">· not live</span>
          </span>
          <nav aria-label="Preview pages" className="flex flex-wrap gap-x-3 gap-y-1">
            {PAGES.map((page) => (
              <Link
                key={page.key}
                href={`/admin/theme/preview/${page.key}?theme=${slug}`}
                aria-current={page.key === entry.key ? 'page' : undefined}
                className={`inline-flex min-h-9 items-center underline-offset-4 hover:underline ${
                  page.key === entry.key ? 'text-amber underline' : 'text-linen/85'
                }`}
              >
                {page.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {theme.definition ? (
              <Link
                href={`/admin/theme/preview/${entry.key}?theme=default`}
                className="inline-flex min-h-9 items-center text-linen/85 underline-offset-4 hover:underline"
              >
                Compare with Default
              </Link>
            ) : (
              <Link
                href={`/admin/theme/preview/${entry.key}?theme=${Object.keys(THEMES)[0]}`}
                className="inline-flex min-h-9 items-center text-linen/85 underline-offset-4 hover:underline"
              >
                Back to the seasonal look
              </Link>
            )}
            <Link
              href="/admin/theme"
              className="inline-flex min-h-9 items-center rounded-full bg-amber px-4 font-semibold text-teal"
            >
              Back to settings
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
