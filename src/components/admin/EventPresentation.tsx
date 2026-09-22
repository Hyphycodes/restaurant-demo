'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Label, TextInput } from '@/components/admin/ui';
import {
  ART_SLOT_SPEC,
  CATEGORY_LABEL,
  EVENT_ART_SLOTS,
  EVENT_CATEGORIES,
  EVENT_TREATMENTS,
  PRESET_STYLE,
  TREATMENT_LABEL,
  VISUAL_PRESETS,
  type EventArtSlot,
} from '@/content/event-presentation';
import type { EventPresentation } from '@/content/types';
import {
  clearEventArt,
  saveEventPresentation,
  uploadEventArt,
} from '@/server/actions/event-presentation';

/**
 * How one event looks on the website.
 *
 * Two cards, in the order somebody thinks: what kind of event is this and how
 * big should it be, then what pictures does it have. No CSS, no colours, no
 * numbers beyond a tie-break — the admin picks named things and the design
 * system decides what they mean.
 */

export interface ArtSlotState {
  slot: EventArtSlot;
  path: string | null;
  /** True once a picture is actually in this slot. */
  filled: boolean;
}

export function EventPresentationEditor({
  table,
  id,
  title,
  presentation,
  art,
  takeover,
  canPublish,
}: {
  table: 'event_series' | 'event_occurrences';
  id: string;
  title: string;
  presentation: EventPresentation;
  art: ArtSlotState[];
  takeover: { start: { date: string; time: string }; end: { date: string; time: string } };
  canPublish: boolean;
}) {
  const [treatment, setTreatment] = useState(presentation.treatment);

  return (
    <div className="grid gap-5">
      <Card title="How this event looks">
        <ActionForm action={saveEventPresentation} className="grid gap-5">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`cat-${id}`} hint="Used for the filters on the events page.">
                What kind of event
              </Label>
              <select
                id={`cat-${id}`}
                name="category"
                defaultValue={presentation.category ?? ''}
                disabled={!canPublish}
                className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 text-[0.9375rem] text-brown"
              >
                <option value="">Not set</option>
                {EVENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label
                htmlFor={`price-${id}`}
                hint="In words — “$45 · aperitivo and three pasta courses”. Leave blank to show the ticket price."
              >
                What it costs
              </Label>
              <TextInput
                id={`price-${id}`}
                name="priceText"
                defaultValue={presentation.priceText ?? ''}
                maxLength={120}
                disabled={!canPublish}
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-[0.875rem] font-semibold text-brown">Colour</legend>
            <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
              The accent for this event&apos;s card and page. Everything stays readable whichever you
              pick.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {VISUAL_PRESETS.map((preset) => {
                const style = PRESET_STYLE[preset];
                return (
                  <label
                    key={preset}
                    title={style.hint}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-brown/20 py-1 pl-1 pr-3 text-[0.875rem] text-brown has-[:checked]:border-coral has-[:checked]:bg-coral/8"
                  >
                    <input
                      type="radio"
                      name="visualPreset"
                      value={preset}
                      defaultChecked={presentation.visualPreset === preset}
                      disabled={!canPublish}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="size-7 shrink-0 rounded-full border border-brown/15"
                      style={{
                        background: `radial-gradient(70% 70% at 30% 25%, ${style.accent}, ${style.surface} 70%)`,
                      }}
                    />
                    {style.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="border-t border-brown/12 pt-4">
            <legend className="text-[0.875rem] font-semibold text-brown">How big on the homepage</legend>
            <div className="mt-2 grid gap-2">
              {EVENT_TREATMENTS.map((option) => (
                <label
                  key={option}
                  className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2.5 has-[:checked]:border-coral has-[:checked]:bg-coral/5"
                >
                  <input
                    type="radio"
                    name="treatment"
                    value={option}
                    checked={treatment === option}
                    onChange={() => setTreatment(option)}
                    disabled={!canPublish}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-coral)]"
                  />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {TREATMENT_LABEL[option].name}
                    </span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {TREATMENT_LABEL[option].hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {treatment === 'takeover' ? (
              <div className="mt-4 grid gap-4 rounded-(--radius-sm) border border-amber/40 bg-amber/6 p-3 sm:grid-cols-2">
                <p className="text-[0.8125rem] leading-relaxed text-brown sm:col-span-2">
                  The homepage hero shows this event between these times, in restaurant time, and
                  goes back to normal on its own afterwards. Nothing to remember.
                </p>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <Label htmlFor={`ts-${id}`}>Takes over</Label>
                    <TextInput
                      id={`ts-${id}`}
                      name="takeoverStartDate"
                      type="date"
                      defaultValue={takeover.start.date}
                      disabled={!canPublish}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`tst-${id}`}>at</Label>
                    <TextInput
                      id={`tst-${id}`}
                      name="takeoverStartTime"
                      type="time"
                      defaultValue={takeover.start.time || '00:00'}
                      disabled={!canPublish}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <Label htmlFor={`te-${id}`}>Until</Label>
                    <TextInput
                      id={`te-${id}`}
                      name="takeoverEndDate"
                      type="date"
                      defaultValue={takeover.end.date}
                      disabled={!canPublish}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`tet-${id}`}>at</Label>
                    <TextInput
                      id={`tet-${id}`}
                      name="takeoverEndTime"
                      type="time"
                      defaultValue={takeover.end.time || '23:59'}
                      disabled={!canPublish}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <input type="hidden" name="takeoverStartDate" value="" />
                <input type="hidden" name="takeoverStartTime" value="" />
                <input type="hidden" name="takeoverEndDate" value="" />
                <input type="hidden" name="takeoverEndTime" value="" />
              </>
            )}

            {treatment !== 'standard' ? (
              <div className="mt-4 max-w-xs">
                <Label
                  htmlFor={`pri-${id}`}
                  hint="Only decides which of two events on the same day leads. Higher wins."
                >
                  Order
                </Label>
                <TextInput
                  id={`pri-${id}`}
                  name="priority"
                  inputMode="numeric"
                  defaultValue={String(presentation.priority)}
                  maxLength={2}
                  disabled={!canPublish}
                />
              </div>
            ) : (
              <input type="hidden" name="priority" value={String(presentation.priority)} />
            )}
          </fieldset>

          {canPublish ? (
            <div>
              <SubmitButton>Save how it looks</SubmitButton>
            </div>
          ) : null}
        </ActionForm>
      </Card>

      <Card title="Pictures">
        <p className="measure mb-4 text-[0.875rem] leading-relaxed text-brown-soft">
          The <strong className="font-semibold text-brown">official flyer</strong> is this event&apos;s
          real artwork and the website always shows it. Everything else is extra art the website can
          use to build a bigger card — adding it never changes or replaces the flyer.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {art.map((slot) => (
            <li key={slot.slot}>
              <ArtSlotCard table={table} id={id} state={slot} title={title} canPublish={canPublish} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ArtSlotCard({
  table,
  id,
  state,
  title,
  canPublish,
}: {
  table: string;
  id: string;
  state: ArtSlotState;
  title: string;
  canPublish: boolean;
}) {
  const spec = ART_SLOT_SPEC[state.slot];
  const [file, setFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const inputId = `art-${id}-${state.slot}`;
  const needsConfirm = spec.official && state.filled;

  return (
    <div
      className={`flex h-full flex-col rounded-(--radius-md) border p-3 ${
        spec.official ? 'border-amber/50 bg-amber/6' : 'border-brown/15 bg-linen'
      }`}
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-(--radius-sm) border border-brown/10"
        style={{ background: 'radial-gradient(70% 60% at 70% 20%, rgba(236,150,62,.28), transparent 65%), #1b0b1a' }}
      >
        {state.path ? (
          // The library serves these from wherever the upload landed; a plain
          // image shows any of them without the optimizer's host allow-list.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.path} alt="" className="size-full object-contain p-1.5" />
        ) : (
          <span className="px-4 text-center text-[0.8125rem] text-night-soft">
            {spec.official ? 'No flyer yet' : 'Not set'}
          </span>
        )}
        {spec.official ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-teal">
            Official
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[0.9375rem] font-semibold text-brown">{spec.label}</p>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-brown-soft">{spec.hint}</p>

      {canPublish ? (
        <div className="mt-auto grid gap-2 pt-3">
          {needsConfirm && !replacing ? (
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-(--radius-sm) border border-brown/30 px-3 text-[0.875rem] font-semibold text-brown"
            >
              Replace the official flyer
            </button>
          ) : (
            <ActionForm action={uploadEventArt} className="grid gap-2">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="slot" value={state.slot} />
              {needsConfirm ? <input type="hidden" name="replaceOfficial" value="yes" /> : null}
              <label
                htmlFor={inputId}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-(--radius-sm) border border-dashed border-coral/50 px-3 text-center text-[0.875rem] font-semibold text-clay hover:bg-coral/5"
              >
                {file ? `Use “${file.name}”` : needsConfirm ? 'Choose the new flyer' : 'Choose a picture'}
                <input
                  id={inputId}
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {file ? (
                <SubmitButton>
                  {needsConfirm ? `Replace the flyer for ${title}` : `Save ${spec.label.toLowerCase()}`}
                </SubmitButton>
              ) : null}
              {needsConfirm ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplacing(false);
                    setFile(null);
                  }}
                  className="min-h-9 text-[0.8125rem] text-brown-soft underline underline-offset-4"
                >
                  Keep the flyer it has
                </button>
              ) : null}
            </ActionForm>
          )}

          {/* Website art can be taken away; the official flyer cannot. */}
          <ActionForm action={clearEventArt} className="empty:hidden">
            {!spec.official && state.filled ? (
              <>
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="slot" value={state.slot} />
                <SubmitButton variant="quiet">Remove</SubmitButton>
              </>
            ) : null}
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}

export { EVENT_ART_SLOTS };
