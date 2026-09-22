'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { RichTextField } from '@/components/admin/RichTextField';
import { HelpNote, Label, Select, TextInput } from '@/components/admin/ui';
import type { ActionState } from '@/content/admin-types';
import { CATEGORY_LABEL, EVENT_CATEGORIES } from '@/content/event-presentation';
import { formatPrice } from '@/lib/format';
import { slugify } from '@/lib/event-editor';
import { feePreview } from '@/lib/ticketing/fees';
import {
  addPromoCode,
  autosaveEvent,
  cancelEvent,
  checkSlug,
  deleteEvent,
  duplicateEventFull,
  publishEvent,
  retirePromoCode,
  saveTiers,
  unpublishEvent,
  uploadFlyer,
  type EditorFields,
  type EditorTier,
} from '@/server/actions/event-editor';

/**
 * The event editor. One scrolling page, no tabs, no wizard, no modal.
 *
 * The flyer is the first field because it is what the owner has in hand. The
 * rest follows in the order somebody fills it in. Drafts save themselves a
 * second after a change and say so; a live event's edits wait for Save.
 * Validation is a sentence at the field, never a banner at the top.
 */

export interface EditorPromo {
  id: string;
  code: string;
  kind: 'percent' | 'amount';
  value: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  endsAt: string | null;
  isActive: boolean;
}

export interface EditorProps {
  id: string;
  published: boolean;
  hasDraft: boolean;
  fields: EditorFields;
  flyerPath: string | null;
  tiers: EditorTier[];
  promos: EditorPromo[];
  paidOrders: number;
  ticketsSold: number;
  previewUrl: string;
  canPublish: boolean;
  problems: Record<string, string>;
}

const FIELD = 'mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown placeholder:text-brown-soft/60 focus:border-clay';

export function EventEditor(props: EditorProps) {
  const [fields, setFields] = useState<EditorFields>(props.fields);
  const [tiers, setTiers] = useState<EditorTier[]>(props.tiers);
  const [tiersDirty, setTiersDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [problems, setProblems] = useState<Record<string, string>>(props.problems);
  const [slugTouched, setSlugTouched] = useState(props.published || props.fields.slug.startsWith('event-') === false);
  const [slugNote, setSlugNote] = useState<string | null>(null);
  const [flyerPath, setFlyerPath] = useState(props.flyerPath);
  const [flyerBusy, setFlyerBusy] = useState(false);
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const first = useRef(true);
  const timer = useRef<number | null>(null);

  const update = useCallback((patch: Partial<EditorFields>) => {
    setFields((current) => {
      const next = { ...current, ...patch };
      if (patch.title !== undefined && !slugTouched && !props.published) next.slug = slugify(patch.title);
      return next;
    });
  }, [slugTouched, props.published]);

  /* --------------------------------------------------------- autosave -- */

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const result = await autosaveEvent(props.id, fields);
      setSaveState(result.ok ? 'saved' : 'error');
      if (result.problems) setProblems((current) => ({ ...current, ...result.problems, ...(Object.keys(result.problems ?? {}).length ? {} : {}) }));
    }, 1200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [fields, props.id]);

  /* ------------------------------------------------------------ flyer -- */

  async function onFlyer(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    setFlyerBusy(true);
    setFlyerError(null);
    const local = URL.createObjectURL(file);
    setFlyerPath(local);
    const accent = await dominantColour(file).catch(() => '');
    const body = new FormData();
    body.set('id', props.id);
    body.set('file', file);
    body.set('accentHint', accent);
    const result = await uploadFlyer({ ok: true, message: '' }, body);
    setFlyerBusy(false);
    if (!result.ok) {
      setFlyerError(result.message);
      setFlyerPath(props.flyerPath);
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void onFlyer(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id]);

  /* ------------------------------------------------------------ tiers -- */

  const tierCapacity = tiers.filter((t) => t.isActive).reduce((sum, t) => sum + (t.capacity ?? 0), 0);
  const capacityWarning = fields.capacity && tierCapacity > fields.capacity ? `Ticket types add up to ${tierCapacity} seats but the event holds ${fields.capacity}.` : null;

  const setTier = (id: string, patch: Partial<EditorTier>) => {
    setTiers((current) => current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
    setTiersDirty(true);
  };
  const addTier = (from?: EditorTier) => {
    setTiers((current) => [
      ...current,
      { ...(from ?? { name: '', description: '', priceCents: 1000, capacity: null, maxPerOrder: 10, seatsPerTicket: 1, salesStartAt: null, salesEndAt: null, isActive: true }), id: `new-${crypto.randomUUID()}`, name: from ? `${from.name} copy` : '' },
    ]);
    setTiersDirty(true);
  };
  const removeTier = (id: string) => {
    setTiers((current) => current.filter((tier) => tier.id !== id));
    setTiersDirty(true);
  };
  const [tierMessage, setTierMessage] = useState<string | null>(null);
  async function persistTiers() {
    const result = await saveTiers(props.id, tiers);
    setTierMessage(result.message);
    if (result.ok && result.ids) {
      setTiers((current) => current.map((tier) => ({ ...tier, id: result.ids![tier.id] ?? tier.id })));
      setTiersDirty(false);
    }
  }

  /* ----------------------------------------------------------- promos -- */

  const [promos, setPromos] = useState(props.promos);
  const [promoDraft, setPromoDraft] = useState({ code: '', kind: 'percent' as 'percent' | 'amount', value: 10, limit: '', endsAt: '' });
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  async function submitPromo() {
    const result = await addPromoCode(props.id, {
      code: promoDraft.code,
      kind: promoDraft.kind,
      value: promoDraft.kind === 'amount' ? Math.round(promoDraft.value * 100) : promoDraft.value,
      maxRedemptions: promoDraft.limit ? Number(promoDraft.limit) : null,
      endsAt: promoDraft.endsAt ? new Date(promoDraft.endsAt).toISOString() : null,
    });
    setPromoMessage(result.message);
    if (result.ok) {
      setPromos((current) => [...current, { id: `tmp-${Date.now()}`, code: promoDraft.code.toUpperCase(), kind: promoDraft.kind, value: promoDraft.kind === 'amount' ? Math.round(promoDraft.value * 100) : promoDraft.value, maxRedemptions: promoDraft.limit ? Number(promoDraft.limit) : null, redeemedCount: 0, endsAt: promoDraft.endsAt || null, isActive: true }]);
      setPromoDraft({ code: '', kind: 'percent', value: 10, limit: '', endsAt: '' });
    }
  }

  /* --------------------------------------------------------- publish -- */

  const [publishState, publishAction, publishing] = useActionState<ActionState, FormData>(publishEvent, { ok: true, message: '' });
  const [unpublishState, unpublishAction, unpublishing] = useActionState<ActionState, FormData>(unpublishEvent, { ok: true, message: '' });
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(deleteEvent, { ok: true, message: '' });
  const [cancelState, cancelAction, cancelling] = useActionState<ActionState, FormData>(cancelEvent, { ok: true, message: '' });
  const [dupState, dupAction, duplicating] = useActionState<ActionState, FormData>(duplicateEventFull, { ok: true, message: '' });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);

  useEffect(() => {
    if (!publishState.ok && publishState.errors) setProblems((current) => ({ ...current, ...publishState.errors }));
  }, [publishState]);
  useEffect(() => {
    if (dupState.ok && dupState.message && /^[0-9a-f-]{36}$/.test(dupState.message)) window.location.assign(`/admin/events/one/${dupState.message}`);
  }, [dupState]);
  useEffect(() => {
    if (deleteState.ok && deleteState.message) window.location.assign('/admin/events');
  }, [deleteState]);

  const status = props.published ? (props.hasDraft || saveState === 'saved' ? 'Live, with changes waiting' : 'Live') : 'Draft';

  return (
    <div className="pb-28">
      <div className="grid gap-10">
        {/* 1. Flyer */}
        <Section title="Flyer" hint="The picture you already made. Drop it here, tap to choose, or paste it.">
          <label
            htmlFor="flyer-file"
            onDragOver={(event: DragEvent) => event.preventDefault()}
            onDrop={(event: DragEvent) => { event.preventDefault(); void onFlyer(event.dataTransfer.files[0] ?? null); }}
            className="admin-raised grid min-h-56 cursor-pointer place-items-center overflow-hidden rounded-(--radius-md) border-2 border-dashed border-brown/25 bg-linen p-3 text-center hover:border-brown/50"
          >
            {flyerPath ? (
              // A local preview cannot use next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flyerPath} alt="" className="max-h-[420px] w-auto max-w-full rounded-(--radius-sm) object-contain" />
            ) : (
              <span className="px-6 py-10">
                <span className="block text-[1.0625rem] font-semibold text-brown">Drop the flyer here</span>
                <span className="mt-1 block text-[0.875rem] text-brown-soft">Up to 10MB. It is shown whole, never cropped.</span>
              </span>
            )}
            <input id="flyer-file" type="file" accept="image/*" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => void onFlyer(event.target.files?.[0] ?? null)} />
          </label>
          {flyerBusy ? <p className="mt-2 text-[0.875rem] text-brown-soft">Uploading…</p> : null}
          {flyerError ? <p role="alert" className="mt-2 text-[0.875rem] text-danger">{flyerError}</p> : null}
        </Section>

        {/* 2. Basics */}
        <Section title="The basics">
          <div className="grid gap-5">
            <Field id="ev-title" label="Name" problem={problems.title}>
              <input id="ev-title" className={FIELD} value={fields.title} onChange={(e) => update({ title: e.target.value })} maxLength={120} placeholder="Aperitivo Club Fall Paint & Lunch" />
            </Field>
            <Field id="ev-summary" label="One line" hint="Under the name on the event page and on every card.">
              <input id="ev-summary" className={FIELD} value={fields.summary} onChange={(e) => update({ summary: e.target.value })} maxLength={200} placeholder="Two hours of listening, lunch and a full bar." />
            </Field>
            <Field id="ev-description" label="What to expect">
              <RichTextField id="ev-description" value={fields.descriptionHtml} onChange={(html) => update({ descriptionHtml: html })} />
            </Field>
            <Field id="ev-slug" label="Web address" hint={`cosa-nostraitaliankitchenbar.com/events/${fields.slug || '…'}`} problem={problems.slug ?? slugNote ?? undefined}>
              <input
                id="ev-slug"
                className={FIELD}
                value={fields.slug}
                onChange={(e) => { setSlugTouched(true); update({ slug: e.target.value }); }}
                onBlur={async () => {
                  const result = await checkSlug(fields.slug, props.id);
                  update({ slug: result.slug });
                  setSlugNote(result.available ? (props.published && result.slug !== props.fields.slug ? 'Changing the address of a live event breaks links you have already shared.' : null) : 'Another event already has that address.');
                }}
              />
            </Field>
          </div>
        </Section>

        {/* 3. When */}
        <Section title="When" hint="Chicago time.">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field id="ev-date" label="Date" problem={problems.date}>
              <input id="ev-date" type="date" className={FIELD} value={fields.date} onChange={(e) => update({ date: e.target.value })} />
            </Field>
            <Field id="ev-start" label="Starts" problem={problems.startTime}>
              <input id="ev-start" type="time" step={900} className={FIELD} value={fields.startTime} onChange={(e) => update({ startTime: snap(e.target.value) })} />
            </Field>
            <Field id="ev-end" label="Ends">
              <input id="ev-end" type="time" step={900} className={FIELD} value={fields.endTime} onChange={(e) => update({ endTime: snap(e.target.value) })} />
            </Field>
            <Field id="ev-doors" label="Doors open" hint="Optional.">
              <input id="ev-doors" type="time" step={900} className={FIELD} value={fields.doorsTime} onChange={(e) => update({ doorsTime: snap(e.target.value) })} />
            </Field>
          </div>
        </Section>

        {/* 4. Tickets */}
        <Section title="Tickets">
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice checked={fields.ticketingEnabled} onChange={() => update({ ticketingEnabled: true })} title="Cosa Nostra Ticketing" hint="Sell tickets right here — Apple Pay, Google Pay, card. You keep the list and the money." />
            <Choice checked={!fields.ticketingEnabled} onChange={() => update({ ticketingEnabled: false })} title="External Ticket Link" hint="Guests are sent to another site to buy. No sales tracked here." />
          </div>

          {fields.ticketingEnabled ? (
            <div className="mt-5 grid gap-5">
              {props.paidOrders > 0 ? (
                <HelpNote>{props.ticketsSold} tickets already sold across {props.paidOrders} orders. Prices and capacity can change; what people already paid does not.</HelpNote>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="ev-capacity" label="Seats in the room" hint="Leave blank for no cap." problem={problems.capacity ?? capacityWarning ?? undefined}>
                  <input id="ev-capacity" type="number" inputMode="numeric" min={1} className={FIELD} value={fields.capacity ?? ''} onChange={(e) => update({ capacity: e.target.value ? Number(e.target.value) : null })} />
                </Field>
              </div>

              <ul className="grid gap-4">
                {tiers.map((tier) => (
                  <TierRow key={tier.id} tier={tier} onChange={(patch) => setTier(tier.id, patch)} onDuplicate={() => addTier(tier)} onRemove={() => removeTier(tier.id)} />
                ))}
              </ul>
              {problems.tiers && tiers.length === 0 ? <p className="text-[0.875rem] text-danger">{problems.tiers}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => addTier()} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown">Add a ticket type</button>
                {props.canPublish ? (
                  <button type="button" onClick={persistTiers} disabled={!tiersDirty} className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-coral px-4 text-[0.9375rem] font-semibold text-on-orange disabled:opacity-50">Save ticket types</button>
                ) : null}
                {tierMessage ? <span className="text-[0.875rem] text-brown-soft">{tierMessage}</span> : null}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <Field id="ev-external" label="External ticket link" hint="Where “Get tickets” sends guests. Only used while External Ticket Link is selected above." problem={problems.externalTicketUrl}>
                <input id="ev-external" inputMode="url" className={FIELD} value={fields.externalTicketUrl} onChange={(e) => update({ externalTicketUrl: e.target.value })} placeholder="https://" />
              </Field>
            </div>
          )}
        </Section>

        {/* 5. Details */}
        <Section title="Details guests ask about">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ev-age" label="Age">
              <Select id="ev-age" value={fields.agePolicy ?? ''} onChange={(e) => update({ agePolicy: (e.target.value || null) as EditorFields['agePolicy'] })}>
                <option value="">Not stated</option>
                <option value="all_ages">All ages</option>
                <option value="18+">18+</option>
                <option value="21+">21+</option>
              </Select>
            </Field>
            <Field id="ev-category" label="Kind of event">
              <Select id="ev-category" value={fields.category ?? ''} onChange={(e) => update({ category: (e.target.value || null) as EditorFields['category'] })}>
                <option value="">Not set</option>
                {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>)}
              </Select>
            </Field>
            <Field id="ev-included" label="What's included">
              <input id="ev-included" className={FIELD} value={fields.includedText} onChange={(e) => update({ includedText: e.target.value })} maxLength={200} placeholder="Aperitivo and a shared antipasti course" />
            </Field>
            <Field id="ev-bring" label="What to bring">
              <input id="ev-bring" className={FIELD} value={fields.bringText} onChange={(e) => update({ bringText: e.target.value })} maxLength={200} placeholder="Nothing. Maybe a friend." />
            </Field>
            <Field id="ev-arrival" label="Arriving">
              <input id="ev-arrival" className={FIELD} value={fields.arrivalText} onChange={(e) => update({ arrivalText: e.target.value })} maxLength={200} placeholder="Arrive 15 minutes early. Parking is free behind the building." />
            </Field>
            <Field id="ev-refund" label="Refund policy" hint="Shown at checkout and kept on every order.">
              <textarea id="ev-refund" className={FIELD} rows={3} value={fields.refundPolicy} onChange={(e) => update({ refundPolicy: e.target.value })} maxLength={600} />
            </Field>
          </div>
        </Section>

        {/* 6. Promo codes */}
        <details className="rounded-(--radius-md) border border-brown/12 px-4 py-3">
          <summary className="min-h-11 cursor-pointer text-[1rem] font-semibold text-brown">Promo codes</summary>
          <div className="mt-3 grid gap-4">
            {promos.length > 0 ? (
              <ul className="divide-y divide-brown/10 text-[0.9375rem]">
                {promos.map((promo) => (
                  <li key={promo.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <span className="tabular font-semibold text-brown">{promo.code}</span>
                    <span className="text-brown-soft">{promo.kind === 'percent' ? `${promo.value}% off` : `${formatPrice(promo.value)} off`}</span>
                    <span className="tabular text-brown-soft">used {promo.redeemedCount}{promo.maxRedemptions ? ` of ${promo.maxRedemptions}` : ''}</span>
                    {promo.isActive && props.canPublish && !promo.id.startsWith('tmp-') ? (
                      <button type="button" onClick={async () => { await retirePromoCode(promo.id); setPromos((c) => c.map((p) => (p.id === promo.id ? { ...p, isActive: false } : p))); }} className="ml-auto text-[0.875rem] text-brown-soft underline underline-offset-4">Switch off</button>
                    ) : !promo.isActive ? <span className="ml-auto text-[0.875rem] text-brown-soft">off</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {props.canPublish ? (
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-2"><Label htmlFor="promo-code">Code</Label><TextInput id="promo-code" value={promoDraft.code} onChange={(e) => setPromoDraft({ ...promoDraft, code: e.target.value.toUpperCase() })} maxLength={40} /></div>
                <div><Label htmlFor="promo-kind">Off</Label><Select id="promo-kind" value={promoDraft.kind} onChange={(e) => setPromoDraft({ ...promoDraft, kind: e.target.value as 'percent' | 'amount' })}><option value="percent">Percent</option><option value="amount">Dollars</option></Select></div>
                <div><Label htmlFor="promo-value">{promoDraft.kind === 'percent' ? '%' : '$'}</Label><TextInput id="promo-value" type="number" min={1} value={promoDraft.value} onChange={(e) => setPromoDraft({ ...promoDraft, value: Number(e.target.value) })} /></div>
                <div><Label htmlFor="promo-limit" hint="Optional.">Uses</Label><TextInput id="promo-limit" type="number" min={1} value={promoDraft.limit} onChange={(e) => setPromoDraft({ ...promoDraft, limit: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label htmlFor="promo-ends" hint="Optional.">Expires</Label><TextInput id="promo-ends" type="date" value={promoDraft.endsAt} onChange={(e) => setPromoDraft({ ...promoDraft, endsAt: e.target.value })} /></div>
                <div className="flex items-end"><button type="button" onClick={submitPromo} disabled={promoDraft.code.length < 2} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown disabled:opacity-50">Add code</button></div>
                {promoMessage ? <p className="text-[0.875rem] text-brown-soft sm:col-span-5">{promoMessage}</p> : null}
              </div>
            ) : null}
          </div>
        </details>

        {/* Danger, quietly */}
        <div className="border-t border-brown/10 pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.9375rem]">
            <form action={dupAction}><input type="hidden" name="id" value={props.id} /><button type="submit" disabled={duplicating} className="text-brown underline underline-offset-4">{duplicating ? 'Copying…' : 'Duplicate this event'}</button></form>
            {props.paidOrders === 0 ? (
              <form action={deleteAction}><input type="hidden" name="id" value={props.id} /><button type="submit" disabled={deleting} className="text-brown-soft underline underline-offset-4">{deleting ? 'Deleting…' : 'Delete'}</button></form>
            ) : props.canPublish ? (
              confirmCancel ? (
                <form action={cancelAction} className="flex items-center gap-3">
                  <input type="hidden" name="id" value={props.id} />
                  <button type="submit" disabled={cancelling} className="inline-flex min-h-10 items-center rounded-(--radius-sm) border border-danger px-3 font-semibold text-danger">{cancelling ? 'Cancelling…' : `Cancel event and refund ${props.paidOrders} orders`}</button>
                  <button type="button" onClick={() => setConfirmCancel(false)} className="text-brown-soft underline underline-offset-4">Keep it</button>
                </form>
              ) : (
                <button type="button" onClick={() => setConfirmCancel(true)} className="text-brown-soft underline underline-offset-4">Cancel event</button>
              )
            ) : null}
            {[deleteState, cancelState, dupState].map((s, i) => (!s.ok && s.message ? <p key={i} className="basis-full text-danger">{s.message}</p> : null))}
            {cancelState.ok && cancelState.message ? <p className="basis-full text-brown">{cancelState.message}</p> : null}
          </div>
        </div>
      </div>

      {/* The sticky bar. */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-brown/12 bg-teal/95 backdrop-blur-sm lg:bottom-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <p className="tabular text-[0.8125rem] text-night-text/70">
            {status}
            {saveState === 'saving' ? ' · Saving…' : saveState === 'saved' ? ' · Saved' : saveState === 'error' ? ' · Could not save' : ''}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link href={props.previewUrl} target="_blank" className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-night-text/30 px-4 text-[0.9375rem] font-semibold text-night-text">Preview</Link>
            {props.canPublish && props.published ? (
              <form action={unpublishAction}><input type="hidden" name="id" value={props.id} /><button type="submit" disabled={unpublishing} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-night-text/30 px-4 text-[0.9375rem] font-semibold text-night-text">{unpublishing ? 'Working…' : 'Unpublish'}</button></form>
            ) : null}
            {props.canPublish ? (
              <form action={publishAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={props.id} />
                {props.published && props.paidOrders > 0 && !confirmLive ? (
                  <button type="button" onClick={() => setConfirmLive(true)} className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-amber px-5 text-[0.9375rem] font-semibold text-on-orange">Save changes</button>
                ) : (
                  <button type="submit" disabled={publishing} className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-amber px-5 text-[0.9375rem] font-semibold text-on-orange disabled:opacity-60">
                    {publishing ? 'Working…' : props.published ? (confirmLive ? `Confirm: ${props.ticketsSold} already sold` : 'Save changes') : fields.ticketingEnabled ? 'Publish — tickets go on sale immediately' : 'Publish'}
                  </button>
                )}
              </form>
            ) : (
              <span className="text-[0.8125rem] text-night-text/70">A manager publishes.</span>
            )}
          </div>
          {!publishState.ok && publishState.message ? <p role="alert" className="basis-full text-[0.875rem] text-amber">{publishState.message}</p> : null}
          {!unpublishState.ok && unpublishState.message ? <p role="alert" className="basis-full text-[0.875rem] text-amber">{unpublishState.message}</p> : null}
          {publishState.ok && publishState.message ? <p className="basis-full text-[0.875rem] text-night-text">{publishState.message}</p> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ pieces -- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[1.125rem] font-semibold text-brown">{title}</h2>
      {hint ? <p className="mt-0.5 text-[0.875rem] text-brown-soft">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, problem, children }: { id: string; label: string; hint?: string; problem?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {children}
      {problem ? <p id={`${id}-problem`} className="mt-1.5 text-[0.8125rem] font-medium text-danger">{problem}</p> : null}
    </div>
  );
}

function Choice({ checked, onChange, title, hint }: { checked: boolean; onChange: () => void; title: string; hint: string }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-(--radius-md) border-2 px-4 py-3 ${checked ? 'border-coral' : 'border-brown/15'}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 size-4 accent-[var(--color-coral)]" />
      <span>
        <span className="block text-[0.9375rem] font-semibold text-brown">{title}</span>
        <span className="block text-[0.8125rem] text-brown-soft">{hint}</span>
      </span>
    </label>
  );
}

function TierRow({ tier, onChange, onDuplicate, onRemove }: { tier: EditorTier; onChange: (patch: Partial<EditorTier>) => void; onDuplicate: () => void; onRemove: () => void }) {
  const fee = feePreview(tier.priceCents);
  return (
    <li className="admin-raised rounded-(--radius-md) border border-brown/12 bg-linen p-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2"><Label htmlFor={`t-name-${tier.id}`}>Name</Label><TextInput id={`t-name-${tier.id}`} value={tier.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Adult" maxLength={80} /></div>
        <div><Label htmlFor={`t-price-${tier.id}`}>Price</Label><TextInput id={`t-price-${tier.id}`} inputMode="decimal" value={(tier.priceCents / 100).toString()} onChange={(e) => onChange({ priceCents: Math.max(0, Math.round(Number(e.target.value.replace(/[^0-9.]/g, '') || 0) * 100)) })} /></div>
        <div><Label htmlFor={`t-cap-${tier.id}`} hint="Blank = no cap">How many</Label><TextInput id={`t-cap-${tier.id}`} type="number" min={0} value={tier.capacity ?? ''} onChange={(e) => onChange({ capacity: e.target.value ? Number(e.target.value) : null })} /></div>
        <div><Label htmlFor={`t-max-${tier.id}`}>Max per order</Label><TextInput id={`t-max-${tier.id}`} type="number" min={1} max={50} value={tier.maxPerOrder} onChange={(e) => onChange({ maxPerOrder: Number(e.target.value) || 1 })} /></div>
        <div className="flex items-end gap-2">
          <button type="button" onClick={onDuplicate} className="inline-flex min-h-11 items-center text-[0.875rem] text-brown underline underline-offset-4">Duplicate</button>
          <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center text-[0.875rem] text-brown-soft underline underline-offset-4">Remove</button>
        </div>
      </div>
      <p className="tabular mt-3 text-[0.875rem] text-brown">
        Guest pays {tier.priceCents === 0 ? 'nothing' : formatPrice(tier.priceCents)}.{' '}
        {tier.priceCents > 0 ? <span className="text-brown-soft">You keep {formatPrice(fee.keepCents)} after card fees ({fee.ratePercent}%).</span> : null}
      </p>
      {fee.warning ? <p className="mt-1 text-[0.8125rem] text-warning">{fee.warning}</p> : null}
      <details className="mt-3">
        <summary className="min-h-10 cursor-pointer text-[0.875rem] text-brown-soft">Advanced</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <div><Label htmlFor={`t-seats-${tier.id}`} hint="A table of 4 is 4.">Seats per ticket</Label><TextInput id={`t-seats-${tier.id}`} type="number" min={1} max={20} value={tier.seatsPerTicket} onChange={(e) => onChange({ seatsPerTicket: Number(e.target.value) || 1 })} /></div>
          <div><Label htmlFor={`t-from-${tier.id}`}>On sale from</Label><TextInput id={`t-from-${tier.id}`} type="datetime-local" value={tier.salesStartAt ? toLocalInput(tier.salesStartAt) : ''} onChange={(e) => onChange({ salesStartAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div><Label htmlFor={`t-to-${tier.id}`}>Until</Label><TextInput id={`t-to-${tier.id}`} type="datetime-local" value={tier.salesEndAt ? toLocalInput(tier.salesEndAt) : ''} onChange={(e) => onChange({ salesEndAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div className="sm:col-span-4"><Label htmlFor={`t-desc-${tier.id}`}>Description</Label><TextInput id={`t-desc-${tier.id}`} value={tier.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={200} placeholder="Aperitivo and a shared antipasti course." /></div>
          <label className="flex min-h-11 items-center gap-2 text-[0.875rem] text-brown sm:col-span-4"><input type="checkbox" checked={tier.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} className="size-4 accent-[var(--color-coral)]" />On sale</label>
        </div>
      </details>
    </li>
  );
}

function snap(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) return value;
  const [h, m] = value.split(':').map(Number);
  const snapped = Math.round(m! / 15) * 15;
  const hour = (h! + Math.floor(snapped / 60)) % 24;
  return `${String(hour).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The flyer's dominant colour, from a 32px thumbnail on a record. */
async function dominantColour(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const record = document.createElement('canvas');
  record.width = 32;
  record.height = 32;
  const context = record.getContext('2d');
  if (!context) return '';
  context.drawImage(bitmap, 0, 0, 32, 32);
  bitmap.close();
  const { data } = context.getImageData(0, 0, 32, 32);
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    if (a < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Skip near-white and near-black: a flyer's paper and its type are not its colour.
    if (max > 240 && min > 220) continue;
    if (max < 30) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n += 1; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  const best = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  if (!best) return '';
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
