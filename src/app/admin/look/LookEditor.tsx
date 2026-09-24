'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { HelpNote, Label } from '@/components/admin/ui';
import { useSaveStatus } from '@/components/admin/SaveStatus';
import type { ActionState } from '@/content/admin-types';
import {
  auditLook,
  PRESET_DEFINITIONS,
  PRESETS,
  resolveLook,
  SEASONS,
  type Appearance,
  type Season,
} from '@/lib/appearance/presets';
import { saveAppearance } from '@/server/actions/appearance';

/**
 * The look, with the real site beside it.
 *
 * Four presets, two dials, a season. The right half is the actual homepage
 * and an actual event page in iframes; every change is posted into them as
 * variables, debounced, so the owner sees the site — not a mock-up — change.
 * Nothing goes live until Save.
 */

const SEASON_LABEL: Record<Season, string> = {
  none: 'No decorations',
  halloween: 'Halloween',
  nocturne: 'Autumn evenings',
  winter: 'Winter (no artwork yet)',
  spring: 'Spring (no artwork yet)',
};

export function LookEditor({
  saved,
  eventSlug,
  canPublish,
}: {
  saved: Appearance;
  /** A real event to show in the second frame, if one exists. */
  eventSlug: string | null;
  canPublish: boolean;
}) {
  const [draft, setDraft] = useState<Appearance>(saved);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveAppearance, { ok: true, message: '' });
  const announce = useSaveStatus();
  const look = useMemo(() => resolveLook(draft), [draft]);
  const audit = useMemo(() => auditLook(look), [look]);
  const definition = PRESET_DEFINITIONS[draft.preset];
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Repaint the frames, debounced, whenever the draft changes.
  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const frame of frames.current) {
        frame?.contentWindow?.postMessage({ type: 'casa-aurelia:appearance', vars: look.vars }, window.location.origin);
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [look]);

  // A frame that finishes loading after a change asks for the current draft.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type !== 'casa-aurelia:appearance-ready') return;
      for (const frame of frames.current) {
        const target = frame?.contentWindow;
        if (target && target === event.source) {
          target.postMessage({ type: 'casa-aurelia:appearance', vars: look.vars }, window.location.origin);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [look]);

  useEffect(() => {
    if (!announce) return;
    if (pending) announce({ tone: 'busy', message: 'Saving the look…' });
    else if (state.ok && state.message) announce({ tone: 'ok', message: state.message, affected: state.affected });
  }, [pending, state, announce]);

  const set = (patch: Partial<Appearance>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form action={formAction} className="grid gap-6 lg:col-span-5">
        <input type="hidden" name="preset" value={draft.preset} />
        <input type="hidden" name="surfaceHex" value={draft.surfaceHex ?? ''} />
        <input type="hidden" name="accentHex" value={draft.accentHex ?? ''} />
        <input type="hidden" name="season" value={draft.season} />
        <input type="hidden" name="decorationsEnabled" value={String(draft.decorationsEnabled)} />
        <input type="hidden" name="decorationIntensity" value={draft.decorationIntensity} />
        <input type="hidden" name="adminFollowsSite" value={String(draft.adminFollowsSite)} />

        {/* Presets */}
        <fieldset>
          <legend className="text-[1rem] font-semibold text-brown">Look</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PRESETS.map((name) => {
              const preset = PRESET_DEFINITIONS[name];
              const selected = draft.preset === name;
              return (
                <label
                  key={name}
                  className={`relative flex cursor-pointer flex-col overflow-hidden rounded-(--radius-md) border-2 transition-colors ${
                    selected ? 'border-coral' : 'border-brown/15 hover:border-brown/35'
                  }`}
                >
                  <input
                    type="radio"
                    name="preset-choice"
                    value={name}
                    checked={selected}
                    onChange={() => set({ preset: name, surfaceHex: null, accentHex: null })}
                    disabled={!canPublish}
                    className="sr-only"
                  />
                  {/* A real screenshot of the site in this look, generated by
                      scripts/generate-look-thumbnails.mjs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/media/diningRoom.webp" alt="" width={640} height={400} className="aspect-[8/5] w-full object-cover object-top" style={{ background: preset.tokens.surface }} />
                  <span className="px-3 py-2.5">
                    <span className="block text-[0.9375rem] font-semibold text-brown">{preset.label}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-brown-soft">{preset.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Dials */}
        <Dial
          label="Background"
          hint="The page surface. Text adjusts itself to stay readable."
          swatches={definition.surfaces}
          value={draft.surfaceHex ?? definition.tokens.surface}
          custom={draft.surfaceHex}
          onChange={(hex) => set({ surfaceHex: hex })}
          disabled={!canPublish}
        />
        <Dial
          label="Accent"
          hint="Buttons and the one highlight per screen."
          swatches={definition.accents}
          value={draft.accentHex ?? definition.tokens.accent}
          custom={draft.accentHex}
          onChange={(hex) => set({ accentHex: hex })}
          disabled={!canPublish}
        />

        {look.refused.length > 0 ? (
          <p role="alert" className="rounded-(--radius-md) border border-warning/40 bg-warning/8 px-4 py-3 text-[0.9375rem] text-brown">
            {look.refused.map((entry) => entry.reason).join(' ')}
          </p>
        ) : look.notes.length > 0 ? (
          <HelpNote>{look.notes.join(' ')}</HelpNote>
        ) : null}

        <details className="rounded-(--radius-md) border border-brown/12 px-4 py-2">
          <summary className="min-h-10 cursor-pointer text-[0.875rem] font-semibold text-brown">Contrast check</summary>
          <ul className="mb-2 mt-1 grid gap-1 text-[0.8125rem]">
            {audit.map((entry) => (
              <li key={entry.pair} className="flex justify-between gap-4">
                <span className="text-brown-soft">{entry.pair}</span>
                <span className={`tabular ${entry.ok ? 'text-success' : 'text-danger'}`}>{entry.ratio}:1</span>
              </li>
            ))}
          </ul>
        </details>

        {/* Season */}
        <fieldset className="grid gap-3">
          <legend className="text-[1rem] font-semibold text-brown">Season</legend>
          <div>
            <Label htmlFor="look-season">Decorations</Label>
            <select
              id="look-season"
              value={draft.season}
              onChange={(event) => set({ season: event.target.value as Season })}
              disabled={!canPublish}
              className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 text-[0.9375rem] text-brown"
            >
              {SEASONS.map((season) => (
                <option key={season} value={season}>{SEASON_LABEL[season]}</option>
              ))}
            </select>
          </div>
          {draft.season !== 'none' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-11 items-center gap-2.5 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 text-[0.9375rem] text-brown">
                <input type="checkbox" checked={draft.decorationsEnabled} onChange={(event) => set({ decorationsEnabled: event.target.checked })} disabled={!canPublish} className="size-4 accent-[var(--color-coral)]" />
                Show the decorations
              </label>
              <div className="flex gap-2">
                {(['subtle', 'lively'] as const).map((level) => (
                  <label key={level} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-(--radius-sm) border text-[0.9375rem] font-semibold ${draft.decorationIntensity === level ? 'border-coral text-brown' : 'border-brown/15 text-brown-soft'}`}>
                    <input type="radio" name="intensity-choice" value={level} checked={draft.decorationIntensity === level} onChange={() => set({ decorationIntensity: level })} disabled={!canPublish} className="sr-only" />
                    {level === 'subtle' ? 'Subtle' : 'Lively'}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
            <input type="checkbox" checked={draft.adminFollowsSite} onChange={(event) => set({ adminFollowsSite: event.target.checked })} disabled={!canPublish} className="size-4 accent-[var(--color-coral)]" />
            The admin wears the same look
          </label>
        </fieldset>

        {canPublish ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending || !dirty || look.refused.length > 0} className="inline-flex min-h-11 items-center rounded-(--radius-sm) bg-coral px-5 text-[0.9375rem] font-semibold text-on-orange disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setDraft(saved)} disabled={!dirty || pending} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown disabled:opacity-50">
              Discard
            </button>
            <button type="button" onClick={() => setDraft({ ...draft, preset: 'evening', surfaceHex: null, accentHex: null })} className="inline-flex min-h-11 items-center text-[0.875rem] text-brown-soft underline underline-offset-4">
              Reset to Evening
            </button>
            {!state.ok && state.message ? <p role="alert" className="basis-full text-[0.875rem] text-danger">{state.message}</p> : null}
          </div>
        ) : (
          <HelpNote>Only a manager or the owner can change the website&apos;s look.</HelpNote>
        )}
      </form>

      {/* The real site. */}
      <div className="grid gap-4 lg:col-span-7">
        <p className="text-[0.8125rem] text-brown-soft">The real website, redrawn as you change things. Nothing goes live until you save.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <iframe
            ref={(node) => { frames.current[0] = node; }}
            title="Homepage preview"
            src="/look-preview"
            className="aspect-[9/14] w-full rounded-(--radius-md) border border-brown/15 bg-ivory"
          />
          <iframe
            ref={(node) => { frames.current[1] = node; }}
            title="Event page preview"
            src={eventSlug ? `/look-preview/events/${encodeURIComponent(eventSlug)}` : '/look-preview/events'}
            className="aspect-[9/14] w-full rounded-(--radius-md) border border-brown/15 bg-ivory"
          />
        </div>
      </div>
    </div>
  );
}

function Dial({
  label,
  hint,
  swatches,
  value,
  custom,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  swatches: string[];
  value: string;
  custom: string | null;
  onChange: (hex: string | null) => void;
  disabled: boolean;
}) {
  const id = `dial-${label.toLowerCase()}`;
  return (
    <fieldset>
      <legend className="text-[1rem] font-semibold text-brown">{label}</legend>
      <p className="mt-0.5 text-[0.8125rem] text-brown-soft">{hint}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            disabled={disabled}
            aria-label={`${label} ${hex}`}
            aria-pressed={value.toLowerCase() === hex.toLowerCase()}
            className={`size-11 rounded-full border-2 ${value.toLowerCase() === hex.toLowerCase() ? 'border-coral' : 'border-brown/20'}`}
            style={{ background: hex }}
          />
        ))}
        <label htmlFor={id} className="ml-1 flex items-center gap-2 text-[0.8125rem] text-brown-soft">
          <input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="size-11 cursor-pointer rounded-full border-2 border-brown/20 bg-transparent p-0.5" />
          Custom
        </label>
        {custom ? (
          <button type="button" onClick={() => onChange(null)} className="text-[0.8125rem] text-brown-soft underline underline-offset-4">
            Use the preset&apos;s
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
