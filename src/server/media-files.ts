import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocalDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';
import { friendlyFileName } from '@/lib/media-names';
import { getServiceClient, getSessionClient } from '@/lib/supabase/server';
import type { Staff } from './auth';

export const ACCEPTED_MEDIA: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/avif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};

const MAX_IMAGE_BYTES = 10_000_000;
const MAX_VIDEO_BYTES = 25_000_000;
const MAX_DIRECT_VIDEO_BYTES = 50_000_000;

export interface DirectMediaUpload {
  url: string;
  mime: string;
  size: number;
  originalName: string;
  width: number;
  height: number;
}

function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function storeMediaFile({
  db,
  staff,
  file,
  title,
  alt,
  tags = [],
}: {
  db: Db;
  staff: Staff;
  file: File;
  title?: string;
  alt?: string;
  tags?: string[];
}): Promise<{ ok: true; assetId: string; title: string } | { ok: false; message: string }> {
  if(DEMO_MODE) return {ok:false,message:'Uploads are disabled in Demo Workspace. Explore the existing sample media and edit its details.'};
  const kind = ACCEPTED_MEDIA[file.type];
  if (!kind) {
    return { ok: false, message: 'Choose a photo (JPEG, PNG, WebP or AVIF) or a video (MP4 or WebM).' };
  }

  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return {
      ok: false,
      message: `${kind === 'video' ? 'That video' : 'That photo'} is too large. Choose a file under ${limit / 1_000_000}MB.`,
    };
  }

  const displayTitle = title?.trim() || friendlyFileName(file.name);
  const base = slugOf(file.name) || 'upload';
  const existing = await db.list<Row>('media_assets');
  let assetId = base;
  let n = 2;
  while (existing.some((row) => row.asset_id === assetId)) assetId = `${base}-${n++}`;

  let extension = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? (kind === 'video' ? '.mp4' : '.jpg');
  let bytes: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  // Flyers arrive as 10MB PNGs straight out of Canva. The website serves a
  // web-optimised copy: no wider than 1800px, WebP, quality 84. The original
  // is not kept — the owner has it, and the site never needs more.
  if (kind === 'image' && (file.size > 700_000 || /\.(png|jpe?g)$/i.test(file.name))) {
    const optimised = await optimiseImage(bytes);
    if (optimised) {
      bytes = optimised;
      extension = '.webp';
      contentType = 'image/webp';
    }
  }
  const filename = `${assetId}${extension}`;

  let publicPath: string;
  if (isLocalDb()) {
    const dir = path.join(process.cwd(), 'public', 'media', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
    publicPath = `/media/uploads/${filename}`;
  } else {
    const supabase = staff.source === 'open' ? getServiceClient() : await getSessionClient();
    if (!supabase) return { ok: false, message: 'The upload service is not available right now.' };
    const { error } = await supabase.storage
      .from('media')
      .upload(filename, bytes, { contentType, upsert: false });
    if (error) return { ok: false, message: 'The upload did not finish. Please try once more.' };
    publicPath = supabase.storage.from('media').getPublicUrl(filename).data.publicUrl;
  }

  const size = kind === 'image' ? await imageSize(bytes) : null;
  return insertMediaRecord({
    db,
    staff,
    asset_id: assetId,
    path: publicPath,
    title: displayTitle,
    alt,
    kind,
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    tags,
    mime: contentType,
    size_bytes: bytes.length,
  });
}

async function optimiseImage(bytes: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(bytes).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    return null;
  }
}

export async function registerDirectMedia({
  db,
  staff,
  upload,
  title,
  alt,
  tags = [],
}: {
  db: Db;
  staff: Staff;
  upload: DirectMediaUpload;
  title?: string;
  alt?: string;
  tags?: string[];
}): Promise<{ ok: true; assetId: string; title: string } | { ok: false; message: string }> {
  if (DEMO_MODE) return {ok:false,message:'Uploads are disabled in Demo Workspace.'};
  const kind = ACCEPTED_MEDIA[upload.mime];
  if (!kind) return { ok: false, message: 'Choose a supported photo or video.' };
  const limit = kind === 'video' ? MAX_DIRECT_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (upload.size > limit) {
    return { ok: false, message: `That ${kind} is too large. Choose one under ${limit / 1_000_000}MB.` };
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  const expected = projectUrl ? `${projectUrl}/storage/v1/object/public/media/` : '';
  if (!expected || !upload.url.startsWith(expected)) {
    return { ok: false, message: 'That upload did not come from the Casa Aurelia media library.' };
  }

  const displayTitle = title?.trim() || friendlyFileName(upload.originalName);
  const base = slugOf(upload.originalName) || 'upload';
  const existing = await db.list<Row>('media_assets');
  let assetId = base;
  let n = 2;
  while (existing.some((row) => row.asset_id === assetId)) assetId = `${base}-${n++}`;

  return insertMediaRecord({
    db,
    staff,
    asset_id: assetId,
    path: upload.url,
    title: displayTitle,
    alt,
    kind,
    width: upload.width,
    height: upload.height,
    tags,
    mime: upload.mime,
    size_bytes: upload.size,
  });
}

async function insertMediaRecord({
  db,
  staff,
  asset_id: assetId,
  path: publicPath,
  title,
  alt,
  kind,
  width,
  height,
  tags,
  mime,
  size_bytes: sizeBytes,
}: {
  db: Db;
  staff: Staff;
  asset_id: string;
  path: string;
  title: string;
  alt?: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  tags: string[];
  mime: string;
  size_bytes: number;
}): Promise<{ ok: true; assetId: string; title: string }> {
  const safeWidth = width || (kind === 'video' ? 1920 : 0);
  const safeHeight = height || (kind === 'video' ? 1080 : 0);
  const description = alt?.trim() || `${kind === 'video' ? 'Video' : 'Photo'}: ${title}`;

  await db.insert('media_assets', {
    asset_id: assetId,
    path: publicPath,
    title,
    alt: description,
    decorative: false,
    kind,
    width: safeWidth,
    height: safeHeight,
    ratio: safeWidth && safeHeight ? `${safeWidth}:${safeHeight}` : kind === 'video' ? '16:9' : '1:1',
    focal: '50% 50%',
    poster: kind === 'video' ? '/media/home/hero-poster.jpg' : null,
    status: 'final',
    tags,
    size_bytes: sizeBytes,
    mime,
    duration_seconds: null,
    uploaded_by: staff.source === 'supabase' ? staff.id : null,
    draft: null,
    archived_at: null,
  });

  return { ok: true, assetId, title };
}

async function imageSize(bytes: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const { default: sharp } = await import('sharp');
    const meta = await sharp(bytes).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}
