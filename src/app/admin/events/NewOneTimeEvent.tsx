'use client';

import { useEffect, useState } from 'react';
import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { useDirectMediaUpload } from '@/components/admin/useDirectMediaUpload';
import { Card, Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import { createOneTimeEvent } from '@/server/actions/events';

/**
 * A one-off night — New Year's Eve, a guest DJ, a private takeover.
 *
 * One screen, not a six-step wizard: a wizard is worth it when the steps depend
 * on each other, and these do not. It can publish immediately or save for later,
 * and it works in one column at 390px.
 */
export function NewOneTimeEvent({
  flyerOptions,
  canPublish,
}: {
  flyerOptions: { id: string; label: string }[];
  canPublish: boolean;
}) {
  const [artwork, setArtwork] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const direct = useDirectMediaUpload(artwork);

  useEffect(() => {
    if (!artwork) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(artwork);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [artwork]);

  return (
    <Card title="Add an event">
      <p className="mb-5 text-[0.9375rem] leading-relaxed text-brown-soft">
        Add the important details. You can come back and change anything later.
      </p>
      <ActionForm action={createOneTimeEvent} className="grid gap-5" onSubmit={direct.onSubmit}>
        <IntentField name="publish" />
        {direct.upload ? (
          <>
            <input type="hidden" name="uploadedUrl" value={direct.upload.url} />
            <input type="hidden" name="uploadedMime" value={direct.upload.mime} />
            <input type="hidden" name="uploadedSize" value={direct.upload.size} />
            <input type="hidden" name="uploadedOriginalName" value={direct.upload.originalName} />
            <input type="hidden" name="uploadedWidth" value={direct.upload.width} />
            <input type="hidden" name="uploadedHeight" value={direct.upload.height} />
          </>
        ) : null}
        <div>
          <Label htmlFor="one-title">Event name</Label>
          <TextInput id="one-title" name="title" required maxLength={120} placeholder="New Year’s Eve at Casa Aurelia" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="one-date">Date</Label>
            <TextInput id="one-date" name="date" type="date" required />
          </div>
          <div>
            <Label htmlFor="one-start">Starts</Label>
            <TextInput id="one-start" name="startTime" type="time" defaultValue="21:00" required />
          </div>
          <div>
            <Label htmlFor="one-end">Ends</Label>
            <TextInput id="one-end" name="endTime" type="time" defaultValue="02:00" required />
          </div>
        </div>

        <div className="grid gap-3">
          <Label htmlFor="event-artwork">Event picture</Label>
          <label
            htmlFor="event-artwork"
            className="grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-(--radius-md) border-2 border-dashed border-coral/35 bg-coral/4 text-center transition hover:border-coral"
          >
            {preview ? (
              // A local preview cannot use next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your event artwork" className="max-h-64 w-full object-contain" />
            ) : (
              <span className="px-5 py-8">
                <span className="block font-semibold text-brown">Choose a picture</span>
                <span className="mt-1 block text-[0.8125rem] text-brown-soft">
                  A flyer or photo works. We size it automatically.
                </span>
              </span>
            )}
            <input
              id="event-artwork"
              name={direct.upload ? undefined : 'artworkFile'}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => setArtwork(event.target.files?.[0] ?? null)}
            />
          </label>

          {flyerOptions.length > 0 ? (
            <div>
              <Label htmlFor="one-flyer" hint="Or use a picture already in the library.">
                Choose an existing picture
              </Label>
              <Select id="one-flyer" name="flyerAssetId" defaultValue="">
                <option value="">None selected</option>
                {flyerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="one-tickets" hint="Leave blank if tickets are not ready yet.">
            Ticket link
          </Label>
          <TextInput id="one-tickets" name="ticketUrl" inputMode="url" placeholder="https://" />
        </div>

        <details className="rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-[0.875rem] font-semibold text-brown">
            Add more details
          </summary>
          <div className="grid gap-4 pb-2">
            <div>
              <Label htmlFor="one-description">What should guests know?</Label>
              <TextArea id="one-description" name="description" rows={3} maxLength={1200} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="one-age" hint="Leave blank for all ages.">
                  Minimum age
                </Label>
                <TextInput id="one-age" name="ageMin" inputMode="numeric" maxLength={3} placeholder="21" />
              </div>
              <div>
                <Label htmlFor="one-music" hint="Separate with commas.">
                  Music
                </Label>
                <TextInput id="one-music" name="music" placeholder="Latin, Top 100" />
              </div>
              <div>
                <Label htmlFor="one-price" hint="Leave blank for pay at the door.">
                  Entry price
                </Label>
                <TextInput id="one-price" name="price" inputMode="decimal" placeholder="25" />
              </div>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          {canPublish ? (
            <SubmitButton name="publish" value="true">Add to website</SubmitButton>
          ) : null}
          <SubmitButton variant="secondary" name="publish" value="false">
            Save for later
          </SubmitButton>
        </div>
        {direct.uploading ? <p className="text-[0.875rem] text-brown-soft">Uploading picture…</p> : null}
        {direct.error ? <p className="text-[0.875rem] font-medium text-danger">{direct.error}</p> : null}
      </ActionForm>
    </Card>
  );
}
