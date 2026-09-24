import type { Metadata } from 'next';
import Link from 'next/link';
import { EditorialMenu } from '@/components/aurelia/menu/EditorialMenu';
import { EditorialTitle } from '@/components/aurelia/page/EditorialTitle';
import { PageHero } from '@/components/aurelia/page/PageHero';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { pageCopy, seo } from '@/content/pages';
import { getAllMenus, getSiteSettings } from '@/content/resolve';
import { buildMetadata, JsonLd, menuJsonLd } from '@/lib/seo';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.menu!, path: '/menu' });
export const dynamic = 'force-dynamic';

/**
 * The menu, read like the card on the table.
 *
 * Everything below the opening comes from the menu service, so a price or a
 * dish changed in the admin is what a guest reads here. The kitchen and the
 * bar are one page: `/menu#cocktails` still lands on the bar list.
 */
export default async function MenuPage() {
  const [menus, site, copy] = await Promise.all([getAllMenus(), getSiteSettings(), getPageCopy('menu')]);

  const unpricedIn = (slug: string) =>
    menus
      .find((menu) => menu.slug === slug)
      ?.categories.flatMap((category) => category.items)
      .some((item) => item.priceCents == null) ?? false;

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? 'The menu'}
        title={<EditorialTitle text={copy.heading ?? pageCopy.menu.heading} />}
        lede={copy.body ?? pageCopy.menu.body}
        asset="pastaNight"
        focus={{ x: '55%', y: '40%' }}
        aside={
          <div className="flex flex-wrap gap-3">
            <Link href={site.reservationUrl} className="cn-btn">
              Find your table <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href={site.orderUrl} className="cn-btn cn-btn-ghost">
              Order for pickup
            </Link>
          </div>
        }
      />
      <EditorialMenu menus={menus} footNotes={{ cocktails: unpricedIn('cocktails') ? pageCopy.menu.unpricedNote : undefined }} />
      {menus.map((menu) => (
        <JsonLd key={menu.slug} data={menuJsonLd(menu)} />
      ))}
      <ThemeWorld scene="table" />
    </>
  );
}
