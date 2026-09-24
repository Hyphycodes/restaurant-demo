'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Label, TextInput } from '@/components/admin/ui';
import { clearThemeAsset, deactivateThemes, saveTheme, uploadThemeAsset } from '@/server/actions/theme';
import { INTENSITY_LABEL } from '@/themes/registry';
import { STATUS_LABEL } from '@/themes/schedule';
import {
  THEME_INTENSITIES,
  THEME_OPTIONS,
  type SeasonalThemeSlug,
  type ThemeAssetSlot,
  type ThemeOption,
  type ThemeRecord,
  type ThemeSlug,
  type ThemeStatus,
} from '@/themes/types';

export interface ManagerAsset {
  slot: ThemeAssetSlot;
  label: string;
  hint: string;
  accepts: 'image' | 'video' | 'image-or-video';
  defaultPath: string | null;
  currentPath: string | null;
  currentKind: 'image' | 'video';
  overridden: boolean;
  staleOverride: boolean;
}

interface ManagerTheme {
  slug: SeasonalThemeSlug;
  name: string;
  shortName: string;
  description: string;
  record: ThemeRecord;
  status: ThemeStatus;
  statusDetail: string;
  schedule: { start: { date: string; time: string }; end: { date: string; time: string } };
  assets: ManagerAsset[];
}

const OPTION_COPY: Record<ThemeOption, { name: string; hint: string }> = {
  texture: { name: 'Background texture', hint: 'A faint aged-plaster grain over the whole site.' },
  glow: { name: 'Ambient glow', hint: 'Slow candle-warm light behind the pages.' },
  petals: { name: 'Floating petals', hint: 'Marigold petals drifting down the screen.' },
  edges: { name: 'Decorative edges', hint: 'Editorial ribbons, brass details and the ornaments between sections.' },
  motion: { name: 'Motion', hint: 'Turn off to freeze every effect. Visitors who prefer reduced motion never see it anyway.' },
};

const STATUS_TONE: Record<ThemeStatus, string> = {
  live: 'border-success/50 bg-success/10 text-success',
  scheduled: 'border-amber/60 bg-amber/10 text-brown',
  ended: 'border-warning/60 bg-warning/10 text-warning',
  off: 'border-brown/25 bg-brown/5 text-brown-soft',
};

/**
 * The seasonal look, as one page.
 *
 * Everything that changes the website's look is one form and one Publish
 * button, so there is never a half-published state where the dates are saved
 * but the effects are not. Artwork is separate because each piece is its own
 * upload.
 */
export function ThemeManager({
  choices,
  theme,
  canPublish,
}: {
  choices: { slug: ThemeSlug; name: string; description: string }[];
  theme: ManagerTheme;
  canPublish: boolean;
}) {
  const initial: ThemeSlug = theme.record.enabled ? theme.slug : 'default';
  const [active, setActive] = useState<ThemeSlug>(initial);
  const [scheduled, setScheduled] = useState(theme.record.scheduleEnabled);
  const seasonalChosen = active === theme.slug;
  const previewHref = `/admin/theme/preview?theme=${theme.slug}`;

  return (
    <div className="grid gap-5">
      <ActionForm action={saveTheme} className="grid gap-5">
        <input type="hidden" name="slug" value={theme.slug} />

        {/* 1. Which look --------------------------------------------------- */}
        <Card
          title="1. Which look is the website wearing?"
          action={
            <span
              className={`inline-flex items-center rounded-(--radius-sm) border px-2.5 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.06em] ${STATUS_TONE[theme.status]}`}
            >
              {theme.shortName}: {STATUS_LABEL[theme.status]}
            </span>
          }
        >
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Choose a look</legend>
            {choices.map((choice) => {
              const selected = active === choice.slug;
              return (
                <label
                  key={choice.slug}
                  className={`relative flex cursor-pointer gap-4 rounded-(--radius-md) border-2 p-4 transition-colors ${
                    selected ? 'border-coral bg-coral/5' : 'border-brown/15 bg-ivory hover:border-brown/35'
                  }`}
                >
                  <input
                    type="radio"
                    name="active"
                    value={choice.slug}
                    checked={selected}
                    onChange={() => setActive(choice.slug)}
                    disabled={!canPublish}
                    className="sr-only"
                  />
                  <Swatch slug={choice.slug} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[1rem] font-semibold text-brown">
                      {choice.name}
                      {selected ? (
                        <span className="rounded-full bg-coral px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-on-orange">
                          Chosen
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[0.8125rem] leading-relaxed text-brown-soft">
                      {choice.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="mt-3 text-[0.875rem] text-brown-soft">{theme.statusDetail}</p>
        </Card>

        {/* 2. Preview ------------------------------------------------------ */}
        <Card title="2. See it before anyone else does">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-sm) border border-brown/30 px-4 text-[0.9375rem] font-semibold text-brown transition-colors hover:bg-brown/8"
            >
              Preview {theme.shortName}
              <span aria-hidden="true">↗</span>
            </a>
            <span className="text-[0.875rem] text-brown-soft">
              Opens the real website pages with the look applied. Only staff can see it, and nothing
              changes for guests until you publish.
            </span>
          </div>
        </Card>

        {/* 3. Effects ------------------------------------------------------ */}
        <Card title={`3. What ${theme.shortName} shows`}>
          {!seasonalChosen ? (
            <p className="mb-4 rounded-(--radius-sm) bg-brown/5 px-3 py-2 text-[0.875rem] text-brown-soft">
              These apply once {theme.shortName} is chosen above. You can set them up now and they
              will be waiting.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {THEME_OPTIONS.map((option) => (
              <Toggle
                key={option}
                name={`option.${option}`}
                defaultChecked={theme.record.config.options[option]}
                disabled={!canPublish}
                title={OPTION_COPY[option].name}
                hint={OPTION_COPY[option].hint}
              />
            ))}
          </div>

          <fieldset className="mt-5 border-t border-brown/12 pt-4">
            <legend className="text-[0.875rem] font-semibold text-brown">How much?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {THEME_INTENSITIES.map((level) => (
                <label
                  key={level}
                  className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2.5 has-[:checked]:border-coral has-[:checked]:bg-coral/5"
                >
                  <input
                    type="radio"
                    name="intensity"
                    value={level}
                    defaultChecked={theme.record.config.intensity === level}
                    disabled={!canPublish}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-coral)]"
                  />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {INTENSITY_LABEL[level].name}
                    </span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {INTENSITY_LABEL[level].hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        {/* 4. Dates -------------------------------------------------------- */}
        <Card title="4. When">
          <label className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
            <input
              type="checkbox"
              name="scheduleEnabled"
              value="true"
              checked={scheduled}
              onChange={(event) => setScheduled(event.target.checked)}
              disabled={!canPublish}
              className="size-4 shrink-0 accent-[var(--color-coral)]"
            />
            Only between these dates
          </label>
          <p className="mt-1 text-[0.8125rem] text-brown-soft">
            Leave this off and the look is on the moment you publish, until you switch it off. Turn it
            on and the website changes itself on the dates below, in restaurant time (Chicago).
          </p>

          <div
            className={`mt-4 grid gap-4 sm:grid-cols-2 ${scheduled ? '' : 'pointer-events-none opacity-45'}`}
            aria-disabled={!scheduled}
          >
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <Label htmlFor="startDate">Starts</Label>
                <TextInput
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={theme.schedule.start.date}
                  disabled={!canPublish}
                />
              </div>
              <div>
                <Label htmlFor="startTime">at</Label>
                <TextInput
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue={theme.schedule.start.time}
                  disabled={!canPublish}
                  className="w-32"
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <Label htmlFor="endDate">Ends</Label>
                <TextInput
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={theme.schedule.end.date}
                  disabled={!canPublish}
                />
              </div>
              <div>
                <Label htmlFor="endTime">at</Label>
                <TextInput
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue={theme.schedule.end.time}
                  disabled={!canPublish}
                  className="w-32"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 5. Publish ------------------------------------------------------ */}
        {canPublish ? (
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>
              {seasonalChosen
                ? scheduled
                  ? `Publish ${theme.shortName} for those dates`
                  : `Publish ${theme.shortName} now`
                : 'Publish Default Casa Aurelia'}
            </SubmitButton>
            <span className="text-[0.875rem] text-brown-soft">
              Guests see the change within a minute.
            </span>
          </div>
        ) : null}
      </ActionForm>

      {/* Always mounted while the person can publish: the confirmation lives
          inside the form, and unmounting it on success would swallow the one
          message that says the website actually changed. */}
      {canPublish ? (
        <ActionForm action={deactivateThemes} className="empty:hidden">
          {theme.record.enabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton variant="secondary">Switch back to Default Casa Aurelia right now</SubmitButton>
              <span className="text-[0.875rem] text-brown-soft">
                Keeps every setting above, just takes the look off the website.
              </span>
            </div>
          ) : null}
        </ActionForm>
      ) : null}

      {/* 6. Artwork -------------------------------------------------------- */}
      <Card
        title={`Artwork for ${theme.shortName}`}
        tone="quiet"
      >
        <p className="measure mb-4 text-[0.875rem] leading-relaxed text-brown-soft">
          The look ships with its own artwork. Replace any piece with your own — a photograph of the
          illustration, your own ornaments, a printed banner — and it takes that piece&apos;s place.
          Anything you do not replace keeps the built-in version, so nothing can go missing.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {theme.assets.map((asset) => (
            <li key={asset.slot}>
              <AssetCard asset={asset} slug={theme.slug} canPublish={canPublish} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- pieces -- */

function Swatch({ slug }: { slug: ThemeSlug }) {
  if (slug === 'default') {
    return (
      <span
        aria-hidden="true"
        className="relative size-16 shrink-0 overflow-hidden rounded-(--radius-md) border border-brown/15"
        style={{ background: 'linear-gradient(160deg, #fbf6ea 0%, #fdf3da 45%, #ddb892 100%)' }}
      >
        <span className="absolute bottom-2 left-2 h-2 w-8 rounded-full bg-[#e1553a]" />
        <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-[#0f2e2c]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="relative size-16 shrink-0 overflow-hidden rounded-(--radius-md) border border-amber/40"
      style={{
        background:
          'radial-gradient(60% 50% at 80% 20%, rgba(236,150,62,.55), transparent 65%), radial-gradient(50% 50% at 15% 90%, rgba(150,40,50,.6), transparent 65%), #120a12',
      }}
    >
      <span className="absolute -left-2 -top-2 size-6 rounded-full bg-[#f0961f] shadow-[0_0_0_3px_#d8731c_inset]" />
      <span className="absolute -bottom-3 -right-3 size-8 rounded-full bg-[#f0961f] shadow-[0_0_0_4px_#d8731c_inset]" />
      <span className="absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#5a1d2f_0_8px,#d8862a_8px_16px,#3d1a36_16px_24px,#e6d3b3_24px_32px)] opacity-80" />
    </span>
  );
}

function Toggle({
  name,
  defaultChecked,
  disabled,
  title,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  disabled: boolean;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2.5 has-[:checked]:border-coral/60">
      <span className="relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-brown/25 transition-colors peer-checked:bg-coral peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange" />
        <span className="absolute left-0.5 size-5 rounded-full bg-linen shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-[0.9375rem] font-semibold text-brown">{title}</span>
        <span className="block text-[0.8125rem] leading-snug text-brown-soft">{hint}</span>
      </span>
    </label>
  );
}

function AssetCard({
  asset,
  slug,
  canPublish,
}: {
  asset: ManagerAsset;
  slug: SeasonalThemeSlug;
  canPublish: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const accept =
    asset.accepts === 'image'
      ? 'image/jpeg,image/png,image/webp,image/avif,image/svg+xml'
      : asset.accepts === 'video'
        ? 'video/mp4,video/webm'
        : 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm';
  const inputId = `asset-${asset.slot}`;

  return (
    <div className="flex h-full flex-col rounded-(--radius-md) border border-brown/15 bg-linen p-3">
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-(--radius-sm) border border-brown/10"
        style={{ background: 'radial-gradient(70% 60% at 70% 20%, rgba(236,150,62,.35), transparent 65%), #1b0b1a' }}
      >
        {asset.currentPath ? (
          asset.currentKind === 'video' ? (
            <video src={asset.currentPath} muted playsInline className="size-full object-cover" />
          ) : (
            // Theme artwork can live anywhere the library puts it; a plain image
            // shows it without the optimizer's host allow-list getting in the way.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.currentPath}
              alt=""
              className={
                asset.slot === 'petals'
                  ? 'h-12 w-auto'
                  : asset.slot === 'divider' || asset.slot === 'topDecoration'
                    ? 'size-full object-cover'
                    : 'size-full object-contain p-2'
              }
            />
          )
        ) : (
          <span className="px-4 text-center text-[0.8125rem] text-night-soft">Keeps the Casa Aurelia reel</span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-obsidian/70 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-night-text">
          {asset.overridden ? 'Yours' : 'Built-in'}
        </span>
      </div>

      <p className="mt-3 text-[0.9375rem] font-semibold text-brown">{asset.label}</p>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-brown-soft">{asset.hint}</p>
      {asset.staleOverride ? (
        <p className="mt-1 text-[0.8125rem] font-medium text-warning">
          The file you chose was archived, so the built-in artwork is showing.
        </p>
      ) : null}

      {canPublish ? (
        <div className="mt-auto grid gap-2 pt-3">
          <ActionForm action={uploadThemeAsset} className="grid gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="slot" value={asset.slot} />
            <label
              htmlFor={inputId}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-(--radius-sm) border border-dashed border-coral/50 px-3 text-[0.875rem] font-semibold text-clay transition-colors hover:bg-coral/5"
            >
              {file ? `Use “${file.name}”` : 'Choose a replacement'}
              <input
                id={inputId}
                name="file"
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {file ? <SubmitButton>Replace {asset.label.toLowerCase()}</SubmitButton> : null}
          </ActionForm>
          {/* Mounted whether or not there is an override, so the confirmation
              survives the re-render that removes the button. */}
          <ActionForm action={clearThemeAsset} className="empty:hidden">
            {asset.overridden || asset.staleOverride ? (
              <>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="slot" value={asset.slot} />
                <SubmitButton variant="quiet">Use the built-in artwork</SubmitButton>
              </>
            ) : null}
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
