'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createLinkHub } from '@/server/actions/link-hubs';
import { HUB_TEMPLATES } from '@/features/link-hubs/templates';
import type { LinkHubLocation } from '@/features/link-hubs/types';

export function CreateHubForm({ locations }: { locations: LinkHubLocation[] }) {
  const [state, action, pending] = useActionState(createLinkHub, { ok: true, message: '' });
  const router = useRouter();
  useEffect(() => {
    const destination = state.ok ? state.affected?.find((path) => path.startsWith('/admin/link-hubs/')) : null;
    if (destination) router.push(destination);
  }, [router, state]);
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[0.875rem] font-semibold text-brown">Hub name<input name="name" required maxLength={100} placeholder="Cosa Nostra Live" className="min-h-11 rounded-(--radius-sm) border border-brown/25 bg-ivory px-3 font-normal" /></label>
        <label className="grid gap-1.5 text-[0.875rem] font-semibold text-brown">Permanent URL<span className="flex min-h-11 items-center rounded-(--radius-sm) border border-brown/25 bg-ivory pl-3 text-brown-soft"><span>/go/</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="live" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-brown outline-none" /></span></label>
      </div>
      <label className="grid gap-1.5 text-[0.875rem] font-semibold text-brown">Internal note<textarea name="internalDescription" rows={2} maxLength={400} placeholder="Where this QR will be used" className="rounded-(--radius-sm) border border-brown/25 bg-ivory px-3 py-2 font-normal" /></label>
      <label className="grid gap-1.5 text-[0.875rem] font-semibold text-brown">Location<select name="locationId" defaultValue={locations[0]?.id ?? ''} className="min-h-11 rounded-(--radius-sm) border border-brown/25 bg-ivory px-3 font-normal"><option value="">No location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <fieldset><legend className="text-[0.9375rem] font-semibold text-brown">Start from a template</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(HUB_TEMPLATES).map(([id, template], index) => <label key={id} className="cursor-pointer rounded-(--radius-md) border border-brown/15 bg-ivory p-4 has-[:checked]:border-coral has-[:checked]:ring-1 has-[:checked]:ring-coral"><input type="radio" name="template" value={id} defaultChecked={index === 0} className="sr-only" /><span className="block font-semibold text-brown">{template.label}</span><span className="mt-1 block text-[0.8125rem] leading-relaxed text-brown-soft">{template.description}</span></label>)}</div></fieldset>
      {!state.ok ? <p role="alert" className="text-[0.875rem] text-danger">{state.message}</p> : null}
      <div><button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-coral px-5 font-semibold text-on-orange disabled:opacity-60">{pending ? 'Creating…' : 'Create Link Hub'}</button></div>
    </form>
  );
}
