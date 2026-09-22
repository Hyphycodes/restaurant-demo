import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import EventPage from '@/app/(site)/events/[slug]/page';
import EventsPage from '@/app/(site)/events/page';
import HomePage from '@/app/(site)/page';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { getStaff } from '@/server/auth';
import { canOpen } from '@/server/permissions';
import { DEFAULT_RESOLVED, getActiveTheme, setThemeOverride } from '@/themes/resolve';
import '@/themes/autumn-evening/theme.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Look preview — Cosa Nostra Admin', robots: { index: false, follow: false, nocache: true } };


export default async function LookPreview({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ plain?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'website')) notFound();
  const [{ path = [] }, { plain }] = await Promise.all([params, searchParams]);
  // `plain` shows the palette on its own, without the seasonal layer — what
  // the preset thumbnails are made from.
  if (plain === '1') setThemeOverride(DEFAULT_RESOLVED);
  const theme = await getActiveTheme();

  let page: React.ReactNode;
  if (path.length === 0) page = await HomePage();
  else if (path[0] === 'events' && path.length === 1) page = await EventsPage({ searchParams: Promise.resolve({}) });
  else if (path[0] === 'events' && path[1]) page = await EventPage({ params: Promise.resolve({ slug: path[1] }), searchParams: Promise.resolve({}) });
  else notFound();

  return <SiteChrome theme={theme}>{page}</SiteChrome>;
}
