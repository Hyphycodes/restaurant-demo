import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { SearchField } from '@/components/admin/SearchField';
import {
  Card,
  EmptyState,
  LinkButton,
  StateChip,
  SummaryStrip,
  Tabs,
} from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableMenus } from '@/server/content/menu';
import { canOpen } from '@/server/permissions';
import { AddCategory, CategoryControls } from './CategoryControls';
import { AddItem } from './AddItem';
import { MenuRow } from './MenuRow';

export const dynamic = 'force-dynamic';

const TAB_LABEL: Record<string, string> = {
  food: 'Food',
  cocktails: 'Cocktails & Bar',
};

/**
 * The menu manager.
 *
 * A dense, calm list rather than a grid of cards: this is a working document,
 * and someone scanning for "Queso Dip" is reading names down a column. Sections
 * are disclosures, so the page opens showing structure and you expand the one
 * you need — including with a keyboard, because `<details>` already does that
 * properly and a custom accordion would have to re-earn it.
 */
export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ menu?: string; q?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'menu')) {
    return (
      <AdminShell staff={staff} local={local} title="Menu">
        <NoAccess what="the menu" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  const menus = db ? await getEditableMenus(db) : [];
  const params = await searchParams;
  const active = menus.find((menu) => menu.slug === params.menu) ?? menus[0];
  const query = (params.q ?? '').trim().toLowerCase();
  const matches = query
    ? (active?.categories ?? []).reduce(
        (total, category) =>
          total + category.items.filter((item) => item.name.toLowerCase().includes(query)).length,
        0,
      )
    : 0;
  const canPublish = staffCan(staff, 'content.publish');

  const waiting = menus
    .flatMap((menu) => menu.categories.flatMap((category) => category.items))
    .filter((item) => item.state === 'changed');

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Menu"
      description="Change a price, mark something sold out, or edit a dish. Prices and availability save straight away."
      actions={
        active ? (
          <LinkButton href={active.slug === 'food' ? '/menu' : `/menu#${active.slug}`} external>
            Preview {TAB_LABEL[active.slug] ?? active.title}
          </LinkButton>
        ) : null
      }
    >
      {menus.length === 0 ? (
        <EmptyState>
          The menu editor is not available right now. Please try again in a moment.
        </EmptyState>
      ) : (
        <>
          {/* Three menus, three tabs. Same control as everywhere else in the
              admin, so the mental model carries over. */}
          <div className="mb-5">
            <Tabs
              label="Which menu"
              items={menus.map((menu) => ({
                href: `/admin/menu?menu=${menu.slug}`,
                label: TAB_LABEL[menu.slug] ?? menu.title,
                active: menu.slug === active?.slug,
              }))}
            />
          </div>

          <form className="mb-5 flex max-w-md items-end gap-2" role="search">
            <input type="hidden" name="menu" value={active?.slug ?? 'food'} />
            <SearchField
              id="menu-search"
              name="q"
              label="Find a dish"
              placeholder="Start typing a name"
              initial={params.q ?? ''}
              basePath="/admin/menu"
              keep={{ menu: active?.slug }}
            />
          </form>

          {waiting.length > 0 && canPublish ? (
            <div className="mb-5">
              <SummaryStrip
                tone="warning"
                action={
                  <span className="shrink-0 text-[0.8125rem] text-brown-soft">
                    Open a dish to publish it
                  </span>
                }
              >
                <strong className="font-semibold">
                  {waiting.length} {waiting.length === 1 ? 'change is' : 'changes are'} saved but not
                  on the website yet
                </strong>{' '}
                — {waiting.slice(0, 3).map((item) => item.name).join(', ')}
                {waiting.length > 3 ? ` and ${waiting.length - 3} more` : ''}.
              </SummaryStrip>
            </div>
          ) : null}

          {active ? (
            <div className="grid gap-3">
              {active.categories.length === 0 ? (
                <EmptyState>
                  {active.emptyState ??
                    'Nothing on this menu yet. Guests see a short note instead of an empty page.'}
                </EmptyState>
              ) : null}

              {/* A search that matches nothing used to render every section as
                  null and leave the screen blank, which reads as the admin
                  having broken rather than as no results. */}
              {query && matches === 0 ? (
                <EmptyState>
                  Nothing on this menu is called “{params.q?.trim()}”. Try part of the word, or
                  check the other menus above.
                </EmptyState>
              ) : null}

              {active.categories.map((category) => {
                const items = query
                  ? category.items.filter((item) => item.name.toLowerCase().includes(query))
                  : category.items;
                if (query && items.length === 0) return null;
                const siblings = category.items.map((item) => item.id);

                return (
                  <details
                    key={category.id}
                    open={Boolean(query) || active.categories.length <= 4}
                    className="group rounded-(--radius-md) border border-brown/15 bg-linen transition-colors open:border-brown/25"
                  >
                    <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) px-4 py-3 text-[1.0625rem] font-semibold text-brown transition-colors hover:bg-brown/4 [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="text-[0.75rem] text-brown-soft transition-transform duration-200 group-open:rotate-90"
                      >
                        ▶
                      </span>
                      {category.name}
                      <span className="text-[0.8125rem] font-normal text-brown-soft">
                        {query
                          ? `${items.length} of ${category.items.length}`
                          : `${category.items.length} ${category.items.length === 1 ? 'item' : 'items'}`}
                      </span>
                      {category.state !== 'published' ? <StateChip state={category.state} /> : null}
                    </summary>

                    <div className="border-t border-brown/12 px-4 pb-4">
                      {/* Out of the summary on purpose: a link inside it opens
                          the tab AND folds the section shut behind you. */}
                      <div className="flex justify-end py-2">
                        <Link
                          href={`/menu#${category.id}`}
                          target="_blank"
                          className="text-[0.8125rem] font-semibold text-clay underline underline-offset-4 hover:text-coral-deep"
                        >
                          View this section on the website ↗
                        </Link>
                      </div>
                      {canPublish ? (
                        <CategoryControls
                          id={category.id}
                          name={category.name}
                          note={category.note}
                          siblings={active.categories.map((entry) => entry.id)}
                        />
                      ) : null}
                      <ul>
                        {items.map((item) => (
                          <MenuRow
                            key={item.id}
                            item={item}
                            siblings={siblings}
                            canPublish={canPublish}
                          />
                        ))}
                      </ul>
                      {canPublish ? <AddItem categoryId={category.id} /> : null}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}

          {canPublish && active ? <AddCategory menuSlug={active.slug} /> : null}

          {!canPublish ? (
            <div className="mt-6">
              <Card tone="quiet">
                <p className="text-[0.9375rem] leading-relaxed text-brown-soft">
                  Your account saves changes as drafts. A manager publishes them — your work is kept
                  either way.
                </p>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
