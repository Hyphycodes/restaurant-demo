'use client';

import { useEffect, useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { useDirectMediaUpload } from '@/components/admin/useDirectMediaUpload';
import { Card, Checkbox, Label, TextInput } from '@/components/admin/ui';
import { friendlyFileName } from '@/lib/media-names';
import { uploadMedia } from '@/server/actions/media';

/** One friendly upload: choose it, check the preview, add it. */
export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const direct = useDirectMediaUpload(file);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Card title="Add a photo or video">
      <ActionForm action={uploadMedia} className="grid gap-5" onSubmit={direct.onSubmit}>
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
        <label
          htmlFor="file"
          className="group grid min-h-44 cursor-pointer place-items-center overflow-hidden rounded-(--radius-md) border-2 border-dashed border-coral/40 bg-coral/4 text-center transition hover:border-coral hover:bg-coral/7"
        >
          {preview && file?.type.startsWith('image/') ? (
            // A local object URL cannot go through next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your selected file" className="max-h-72 w-full object-contain" />
          ) : preview && file?.type.startsWith('video/') ? (
            <video src={preview} controls className="max-h-72 w-full bg-espresso object-contain" />
          ) : (
            <span className="px-6 py-10">
              <span className="block text-[1.125rem] font-semibold text-brown">
                Choose from this device
              </span>
              <span className="mt-1 block text-[0.875rem] text-brown-soft">
                Photo or short video · the site handles the rest
              </span>
            </span>
          )}
          <input
            id="file"
            name={direct.upload ? undefined : 'file'}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
            required
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              setFile(chosen);
              setTitle(chosen ? friendlyFileName(chosen.name) : '');
            }}
          />
        </label>

        {file ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-sm) bg-teal/6 px-3 py-2 text-[0.875rem]">
            <span className="font-medium text-brown">{file.name}</span>
            <label htmlFor="file" className="cursor-pointer font-semibold text-clay underline underline-offset-4">
              Choose a different file
            </label>
          </div>
        ) : null}

        <div>
          <Label htmlFor="upload-title" hint="We filled this in from the file name. Change it if you want.">
            Name
          </Label>
          <TextInput
            id="upload-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Friday night at Casa Aurelia"
          />
        </div>

        <details className="rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-[0.875rem] font-semibold text-brown">
            Optional details
          </summary>
          <div className="grid gap-4 pb-2">
            <div>
              <Label htmlFor="upload-alt" hint="Leave blank and we will use the name above.">
                What is shown?
              </Label>
              <TextInput
                id="upload-alt"
                name="alt"
                maxLength={200}
                placeholder="Friends dancing near the bar"
              />
            </div>
            <div>
              <Label htmlFor="upload-tags" hint="Examples: Events, Food, Drinks, Room">
                Help me find it later
              </Label>
              <TextInput id="upload-tags" name="tags" maxLength={200} placeholder="Events, Room" />
            </div>
            <Checkbox id="upload-decorative" name="decorative">
              This is only decoration
            </Checkbox>
          </div>
        </details>

        <div>
          <SubmitButton>{file?.type.startsWith('video/') ? 'Add video' : 'Add photo'}</SubmitButton>
        </div>
        {direct.uploading ? <p className="text-[0.875rem] text-brown-soft">Uploading…</p> : null}
        {direct.error ? <p className="text-[0.875rem] font-medium text-danger">{direct.error}</p> : null}
      </ActionForm>
    </Card>
  );
}
