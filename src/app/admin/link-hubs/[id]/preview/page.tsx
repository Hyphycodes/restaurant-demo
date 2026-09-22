import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { HubRenderer } from '@/components/link-hubs/HubRenderer';
import { getReadDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { getEditableHubPreview } from '@/server/content/link-hubs';

export const dynamic = 'force-dynamic';
export default async function LinkHubPreview({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff(); if (!staff) redirect('/admin/login');
  const { id } = await params; const db = getReadDb(); const page = db ? await getEditableHubPreview(db, id) : null; if (!page) notFound();
  return <><div className="fixed inset-x-0 top-0 z-50 flex min-h-11 items-center justify-between bg-amber px-4 text-[0.8125rem] font-semibold text-on-orange"><span>Preview — analytics and lead storage are off</span><Link href={`/admin/link-hubs/${id}`} className="underline">Back to editor</Link></div><div className="pt-11"><HubRenderer page={{ ...page, preview: true }} /></div></>;
}
