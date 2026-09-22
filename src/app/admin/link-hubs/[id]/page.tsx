import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { LinkButton } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { canOpen } from '@/server/permissions';
import { getEditableHub } from '@/server/content/link-hubs';
import { HubEditor } from './HubEditor';

export const dynamic = 'force-dynamic';
export default async function EditLinkHubPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff(); if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'hubs')) return <AdminShell staff={staff} local={local} title="Link Hub"><NoAccess what="link hubs" /></AdminShell>;
  const { id } = await params; const db = getReadDb(); const data = db ? await getEditableHub(db, id) : null; if (!data) notFound();
  return <AdminShell staff={staff} local={local} title={data.hub.name} description="Build the guest page, schedule modes, and preview the exact mobile experience." backTo={{ href: '/admin/link-hubs', label: 'Link Hubs' }} actions={<><LinkButton href={`/admin/link-hubs/${id}/analytics`}>Analytics</LinkButton>{data.hub.status === 'published' ? <LinkButton href={`/go/${data.hub.slug}`} external>Open live</LinkButton> : null}</>}><HubEditor initial={data} canPublish={staffCan(staff, 'content.publish')} canManageLocation={staffCan(staff, 'settings.manage')} /></AdminShell>;
}
