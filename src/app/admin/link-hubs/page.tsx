import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { EmptyState, LinkButton } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getStaff } from '@/server/auth';
import { canOpen } from '@/server/permissions';
import { listEditableHubs } from '@/server/content/link-hubs';
import { HubListActions } from './HubListActions';

export const dynamic = 'force-dynamic';

export default async function LinkHubsPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'hubs')) return <AdminShell staff={staff} local={local} title="Link Hubs"><NoAccess what="link hubs" /></AdminShell>;
  const db = getReadDb();
  const [hubs, analytics] = db ? await Promise.all([listEditableHubs(db), db.list<Row>('link_hub_analytics', { orderBy: 'created_at', desc: true, limit: 10000 })]) : [[], []];
  const totals = new Map<string, number>();
  analytics.filter((row) => row.event_kind === 'view').forEach((row) => totals.set(String(row.hub_id), (totals.get(String(row.hub_id)) ?? 0) + 1));
  return <AdminShell staff={staff} local={local} title="Link Hubs" description="Permanent QR destinations that can change with the night, the event, or the schedule." actions={<LinkButton href="/admin/link-hubs/new" variant="primary">+ Create Link Hub</LinkButton>}>
    {hubs.length === 0 ? <EmptyState>No hubs yet. Start with Casa Aurelia Main Links or Casa Aurelia Live — every template stays fully editable.</EmptyState> : <div className="grid gap-4">{hubs.map((hub) => <article key={hub.id} className="admin-raised rounded-(--radius-md) border border-brown/12 bg-linen p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[1.0625rem] font-semibold text-brown">{hub.name}</h2><span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${hub.status === 'published' ? 'bg-success/10 text-success' : hub.status === 'archived' ? 'bg-brown/8 text-brown-soft' : 'bg-warning/10 text-warning'}`}>{hub.status === 'published' ? 'Live' : hub.status}</span>{hub.modeStrategy === 'manual' || hub.startAt || hub.endAt ? <span className="rounded-full bg-plum/8 px-2 py-0.5 text-[0.6875rem] font-semibold text-plum">Scheduled</span> : null}</div><p className="mt-1 text-[0.875rem] text-brown-soft">/go/{hub.slug} · {hub.hubType.replaceAll('-', ' ')} · {hub.theme.replaceAll('-', ' ')}</p>{hub.internalDescription ? <p className="mt-2 max-w-2xl text-[0.8125rem] text-brown-soft">{hub.internalDescription}</p> : null}</div><div className="text-right"><strong className="tabular block text-[1.35rem] text-brown">{totals.get(hub.id) ?? 0}</strong><span className="text-[0.75rem] text-brown-soft">visits</span></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><LinkButton href={`/admin/link-hubs/${hub.id}`}>Edit</LinkButton><LinkButton href={`/admin/link-hubs/${hub.id}/analytics`} variant="quiet">Analytics</LinkButton><LinkButton href={`/go/${hub.slug}`} external variant="quiet">Open live</LinkButton><LinkButton href={`/go/${hub.slug}/display`} external variant="quiet">Display</LinkButton><HubListActions id={hub.id} published={hub.status === 'published'} /></div><p className="mt-3 text-[0.75rem] text-brown-soft">Updated {hub.updatedAt ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(hub.updatedAt)) : 'just now'}</p></article>)}</div>}
  </AdminShell>;
}
