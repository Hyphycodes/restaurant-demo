'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Checkbox, FieldNote, Label, Select, TextInput } from '@/components/admin/ui';
import {
  archiveMedia,
  repointMedia,
  replaceMedia,
  saveMediaDetails,
  unarchiveMedia,
} from '@/server/actions/media';
import { Versions } from '@/components/admin/Versions';
import { MEDIA_TAGS } from '@/content/labels';
import type { AdminMedia, VersionEntry } from '@/content/admin-types';

/**
 * Photo details.
 *
 * Two things here are deliberately awkward, because being easy would be worse:
 * archiving something that is still on a page is refused and names where it is
 * used, and swapping asks whether you mean here or everywhere. Both are moments
 * where guessing silently changes a page nobody was looking at.
 */
export function MediaDetails({
  entry,
  alternatives,
  versions,
  canArchive,
  canRestore,
}: {
  entry: AdminMedia;
  alternatives: { id: string; label: string }[];
  versions: VersionEntry[];
  canArchive: boolean;
  canRestore: boolean;
}) {
  return (
    <div className="grid gap-5">
      <Card title="Name & description">
        <ActionForm action={saveMediaDetails} className="grid gap-4">
          <input type="hidden" name="assetId" value={entry.assetId} />

          <div>
            <Label htmlFor="title" hint="Only your team sees this.">
              Name
            </Label>
            <TextInput id="title" name="title" defaultValue={entry.title} maxLength={80} />
          </div>

          <div>
            <Label
              htmlFor="alt"
              hint={
                entry.kind === 'video'
                  ? 'A short description of what happens in the video.'
                  : 'A short description of what the photo shows.'
              }
            >
              Description
            </Label>
            <TextInput id="alt" name="alt" defaultValue={entry.alt ?? ''} maxLength={200} />
          </div>

          <Checkbox id="decorative" name="decorative" defaultChecked={entry.decorative}>
            This is decoration and carries no information
          </Checkbox>

          <details className="rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2">
            <summary className="min-h-11 cursor-pointer py-2 text-[0.875rem] font-semibold text-brown">
              More options
            </summary>
            <div className="grid gap-4 pb-2">
              <div>
                <Label htmlFor="tags" hint={`Choose simple words such as ${MEDIA_TAGS.slice(0, 4).join(', ')}.`}>
                  Help me find it later
                </Label>
                <TextInput id="tags" name="tags" defaultValue={entry.tags.join(', ')} maxLength={200} />
              </div>

              <div>
                <Label htmlFor="focal" hint="The part of a photo to keep when it is cropped.">
                  Crop focus
                </Label>
                <TextInput
                  id="focal"
                  name="focal"
                  defaultValue={entry.focal}
                  placeholder="50% 50%"
                  aria-describedby="focal-note"
                />
                <FieldNote id="focal-note">Leave this as it is unless a face is being cropped out.</FieldNote>
              </div>
            </div>
          </details>

          <div>
            <SubmitButton>Save</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      {entry.usage.length > 0 && alternatives.length > 0 ? (
        <Card title={`Swap this ${entry.kind === 'video' ? 'video' : 'photo'}`}>
          <ActionForm action={replaceMedia} className="grid gap-4">
            <input type="hidden" name="assetId" value={entry.assetId} />

            <div>
              <Label htmlFor="replacementId">Use this instead</Label>
              <Select id="replacementId" name="replacementId" defaultValue="">
                <option value="" disabled>
                  Pick a {entry.kind === 'video' ? 'video' : 'photo'}
                </option>
                {alternatives.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-[0.875rem] font-semibold text-brown">Where?</legend>
              {entry.usage.map((use) => (
                <label
                  key={`${use.href}-${use.label}`}
                  className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown"
                >
                  <input
                    type="radio"
                    name="scope"
                    value="one"
                    className="size-4 shrink-0 accent-[var(--color-coral)]"
                  />
                  Only on {use.label}
                </label>
              ))}
              <label className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  defaultChecked
                  className="size-4 shrink-0 accent-[var(--color-coral)]"
                />
                Everywhere it appears ({entry.usage.length}{' '}
                {entry.usage.length === 1 ? 'place' : 'places'})
              </label>
            </fieldset>

            <div>
              <SubmitButton variant="secondary">Swap it</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : null}

      {/* A slot the design fills. There is no reference row to repoint, so this
          changes which FILE the slot holds — which is the only way to swap a
          photograph the layout asks for by name. */}
      {entry.registryUsage.length > 0 && alternatives.length > 0 ? (
        <Card title={`Change the ${entry.kind === 'video' ? 'video' : 'photo'} in this spot`}>
          <p className="text-[0.9375rem] leading-relaxed text-brown-soft">
            This appears on {entry.registryUsage.join(', ')}. Picking a different one changes it in{' '}
            {entry.registryUsage.length === 1 ? 'that place' : 'all of those places'} and keeps the
            layout looking right.
          </p>

          <ActionForm action={repointMedia} className="mt-4 grid gap-4">
            <input type="hidden" name="assetId" value={entry.assetId} />
            <div>
              <Label htmlFor="repointId">Show this photo instead</Label>
              <Select id="repointId" name="replacementId" defaultValue="" aria-describedby="repoint-note">
                <option value="" disabled>
                  Pick a {entry.kind === 'video' ? 'video' : 'photo'}
                </option>
                {alternatives.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldNote id="repoint-note">
                Its description comes across with it, so the words still match the picture.
              </FieldNote>
            </div>
            <div>
              <SubmitButton variant="secondary">Use this photo</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : null}

      {/* The way back from a swap. A photograph is edited live, so restoring one
          applies straight away rather than waiting behind a publish step. */}
      {versions.length > 0 ? (
        <Versions
          table="media_assets"
          id={entry.assetId}
          versions={versions}
          canRestore={canRestore}
        />
      ) : null}

      {canArchive ? (
        <Card title={entry.archivedAt ? 'Archived' : 'Archive'} tone="quiet">
          <p className="text-[0.9375rem] leading-relaxed text-brown-soft">
            {entry.archivedAt
              ? 'This is out of the library. The file is still there and it can come back.'
              : entry.usage.length > 0
                ? `This is on ${entry.usage.length} ${entry.usage.length === 1 ? 'page' : 'pages'} right now. Swap it out there first — archiving is refused while anything still points at it.`
                : 'Takes it out of the library without deleting the file.'}
          </p>
          <div className="mt-3">
            <ActionForm action={entry.archivedAt ? unarchiveMedia : archiveMedia}>
              <input type="hidden" name="assetId" value={entry.assetId} />
              <SubmitButton variant={entry.archivedAt ? 'secondary' : 'danger'}>
                {entry.archivedAt ? 'Put it back' : 'Archive it'}
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
