'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { duplicateLinkHub, setLinkHubPublished } from '@/server/actions/link-hubs';

export function HubListActions({ id, published }: { id: string; published: boolean }) {
  const [duplicateState, duplicateAction, duplicating] = useActionState(duplicateLinkHub, { ok: true, message: '' });
  const [, publishAction, publishing] = useActionState(setLinkHubPublished, { ok: true, message: '' });
  const router = useRouter();
  useEffect(() => {
    const path = duplicateState.ok ? duplicateState.affected?.find((entry) => entry.startsWith('/admin/link-hubs/')) : null;
    if (path) router.push(path);
  }, [duplicateState, router]);
  return <div className="flex flex-wrap gap-2"><form action={duplicateAction}><input type="hidden" name="id" value={id} /><button disabled={duplicating} className="min-h-10 rounded-(--radius-sm) border border-brown/20 px-3 text-[0.8125rem] font-semibold text-brown">{duplicating ? 'Duplicating…' : 'Duplicate'}</button></form><form action={publishAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="publish" value={published ? 'false' : 'true'} /><button disabled={publishing} className="min-h-10 rounded-(--radius-sm) border border-brown/20 px-3 text-[0.8125rem] font-semibold text-brown">{published ? 'Unpublish' : 'Publish'}</button></form></div>;
}
