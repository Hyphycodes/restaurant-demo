'use client';
import { DEMO_MODE } from '@/lib/demo';

import { createBrowserClient } from '@supabase/ssr';

export interface DirectMediaUpload {
  url: string;
  mime: string;
  size: number;
  originalName: string;
  width: number;
  height: number;
}

export class DirectUploadNeedsSignIn extends Error {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function canUploadDirectly(): boolean {
  if (DEMO_MODE) return false;
  return Boolean(url && key);
}


export async function uploadMediaDirect(file: File): Promise<DirectMediaUpload> {
  if (DEMO_MODE) throw new Error('File uploads are disabled in the portfolio demo. Choose an existing sample asset.');
  if (!url || !key) throw new Error('Uploads are not connected right now.');

  const supabase = createBrowserClient(url, key);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new DirectUploadNeedsSignIn('No signed-in upload session.');

  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-80) || 'upload';
  const storageName = `uploads/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('media').upload(storageName, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error('The upload did not finish. Please try once more.');

  const dimensions = await mediaDimensions(file);
  const publicUrl = supabase.storage.from('media').getPublicUrl(storageName).data.publicUrl;
  return {
    url: publicUrl,
    mime: file.type,
    size: file.size,
    originalName: file.name,
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function mediaDimensions(file: File): Promise<{ width: number; height: number }> {
  if (file.type.startsWith('image/')) {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      return { width: 0, height: 0 };
    }
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const finish = (dimensions: { width: number; height: number }) => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
      resolve(dimensions);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => finish({ width: 0, height: 0 });
    video.src = objectUrl;
  });
}
