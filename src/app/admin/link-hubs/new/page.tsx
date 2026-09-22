import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { canOpen } from '@/server/permissions';
import { listHubLocations } from '@/server/content/link-hubs';
import { CreateHubForm } from '../CreateHubForm';

export const dynamic = 'force-dynamic';
export default async function NewLinkHubPage() {
  const staff = await getStaff(); if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'hubs')) return <AdminShell staff={staff} local={local} title="Create Link Hub"><NoAccess what="link hubs" /></AdminShell>;
  const db = getReadDb(); const locations = db ? await listHubLocations(db) : [];
  return <AdminShell staff={staff} local={local} title="Create Link Hub" description="Pick a useful starting point. The permanent URL stays the same after launch." backTo={{ href: '/admin/link-hubs', label: 'Link Hubs' }}><Card><CreateHubForm locations={locations} /></Card></AdminShell>;
}
