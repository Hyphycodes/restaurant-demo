import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { LinkButton } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getStaff, staffCan } from '@/server/auth';
import { listVersions } from '@/server/content/editorial';
import { getEditableMenus } from '@/server/content/menu';
import { canOpen } from '@/server/permissions';
import { ItemEditor } from './ItemEditor';

export const dynamic = 'force-dynamic';

export default async function MenuItemPage({ params }: { params: Promise<{ item: string }> }) {
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

  const { item: itemId } = await params;
  const db = getReadDb();
  if (!db) notFound();

  const menus = await getEditableMenus(db);
  const found = menus
    .flatMap((menu) => menu.categories.flatMap((category) => category.items.map((i) => ({ menu, category, item: i }))))
    .find((entry) => entry.item.id === itemId);

  if (!found) notFound();

  const [versions, media] = await Promise.all([
    listVersions(db, 'menu_items', itemId),
    db.list<Row>('media_assets', { orderBy: 'asset_id' }),
  ]);
  const mediaOptions = media
    .filter((row) => row.path && !row.archived_at && row.kind !== 'vector')
    .map((row) => ({ id: String(row.asset_id), label: String(row.title ?? row.asset_id) }));

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={found.item.name}
      description={`${found.menu.title} · ${found.category.name}`}
      backTo={{
        href: `/admin/menu?menu=${found.menu.slug}`,
        label: `Back to ${found.menu.title}`,
      }}
      actions={
        <LinkButton href={`/menu#${found.category.id}`} external>
          View on the website
        </LinkButton>
      }
    >
      <ItemEditor
        item={found.item}
        categories={found.menu.categories}
        versions={versions}
        canPublish={staffCan(staff, 'content.publish')}
        archived={found.item.state === 'archived'}
        mediaOptions={mediaOptions}
      />
    </AdminShell>
  );
}
