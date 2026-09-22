import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { HubDisplay } from '@/components/link-hubs/HubDisplay';
import { getReadDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { getEditableHubPreview } from '@/server/content/link-hubs';

export const dynamic = 'force-dynamic';
export default async function AdminHubDisplayPreview({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff(); if (!staff) redirect('/admin/login');
  const { id } = await params; const db = getReadDb(); const page = db ? await getEditableHubPreview(db, id) : null; if (!page) notFound();
  return <><div className="fixed left-4 top-4 z-50 rounded-full bg-amber px-4 py-2 text-[0.75rem] font-semibold text-on-orange shadow-lg">Display preview · <Link href={`/admin/link-hubs/${id}`} className="underline">Back to editor</Link></div><HubDisplay page={page} preview /></>;
}
