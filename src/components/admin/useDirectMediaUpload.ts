'use client';

import { useEffect, useRef, useState, type FormEventHandler } from 'react';
import {
  canUploadDirectly,
  DirectUploadNeedsSignIn,
  uploadMediaDirect,
  type DirectMediaUpload,
} from '@/lib/supabase/browser';

/** Keeps large files out of the website request while preserving a normal HTML fallback locally. */
export function useDirectMediaUpload(file: File | null) {
  const form = useRef<HTMLFormElement | null>(null);
  const ready = useRef(false);
  const previousFile = useRef<File | null>(file);
  const [upload, setUpload] = useState<DirectMediaUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (upload && form.current) form.current.requestSubmit();
  }, [upload]);

  useEffect(() => {
    if (previousFile.current === file) return;
    previousFile.current = file;
    ready.current = false;
    setUpload(null);
    setError('');
  }, [file]);

  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    if (!file || ready.current || !canUploadDirectly()) return;

    event.preventDefault();
    if (uploading) return;
    form.current = event.currentTarget;
    setUploading(true);
    setError('');

    void uploadMediaDirect(file)
      .then((result) => {
        ready.current = true;
        setUpload(result);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DirectUploadNeedsSignIn) {
          // Temporary open-admin previews have no staff session. Let the normal
          // server upload handle the file until private sign-in is enabled.
          ready.current = true;
          form.current?.requestSubmit();
          return;
        }
        setError(cause instanceof Error ? cause.message : 'The upload did not finish. Please try again.');
      })
      .finally(() => setUploading(false));
  };

  return { upload, uploading, error, onSubmit };
}
