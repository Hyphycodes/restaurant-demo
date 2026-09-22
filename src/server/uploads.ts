import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocalDb } from '@/lib/db';
import { extensionFor, safeFileName } from '@/lib/submissions';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Files a stranger sends us: a résumé, a few photographs of somebody's work.
 *
 * These are NOT website media. They belong to the person who sent them, so
 * they go to the private `applications` bucket (migration 0026), never to the
 * public `media` bucket, and the only way anybody sees one afterwards is a
 * short-lived signed URL minted for a signed-in member of staff.
 *
 * Three rules the rest of the system relies on:
 *
 *   1. the stored name is ours, never theirs — a uuid and an extension derived
 *      from the MIME type we accepted, so a file called `../../etc/passwd` or
 *      `invoice.pdf.exe` cannot become a path or a suggestion;
 *   2. type and size are re-checked HERE, on the server, not only in the
 *      browser where a form can be edited;
 *   3. a failed upload is null, never a throw. Somebody's application is worth
 *      more than their attachment: the record is saved either way and the
 *      admin says the file did not arrive.
 */

export const UPLOAD_FOLDERS = ['resumes', 'talent'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const BUCKET = 'applications';
const LOCAL_DIR = path.join(process.cwd(), '.cosa-nostra-local', 'uploads');

export interface StoredUpload {
  /** `resumes/<uuid>.pdf` — the object path, not a URL. */
  path: string;
  /** What they called it, for the admin to show. Display only. */
  name: string;
}

interface StoreOptions {
  folder: UploadFolder;
  allowedTypes: readonly string[];
  maxBytes: number;
}

/** True when a form field is a real, non-empty file rather than an empty input. */
export function isUpload(value: unknown): value is File {
  return value instanceof File && value.size > 0 && value.name !== '';
}

export async function storeUpload(file: File, options: StoreOptions): Promise<StoredUpload | null> {
  if(DEMO_MODE && file.size) throw new Error('File uploads are disabled in the demo. Submit sample text without an attachment.');
  if (!isUpload(file)) return null;
  if (file.size > options.maxBytes) return null;
  if (!options.allowedTypes.includes(file.type)) return null;

  const object = `${options.folder}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const name = safeFileName(file.name);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());

    if (isSupabaseConfigured()) {
      const supabase = getServiceClient();
      if (!supabase) return null;
      const { error } = await supabase.storage.from(BUCKET).upload(object, bytes, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        console.error('[uploads] store failed:', error.message);
        return null;
      }
      return { path: object, name };
    }

    // Development only, and only ever alongside the local database. It is what
    // makes the whole flow — apply, upload, open it in the admin — real on a
    // clean checkout with no Supabase project.
    if (!isLocalDb()) return null;
    const destination = path.join(LOCAL_DIR, object);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    return { path: object, name };
  } catch (error) {
    console.error('[uploads] store failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Store several, dropping the ones that do not qualify. Order is preserved. */
export async function storeUploads(
  files: File[],
  options: StoreOptions & { maxFiles: number },
): Promise<StoredUpload[]> {
  const accepted: StoredUpload[] = [];
  for (const file of files.slice(0, options.maxFiles)) {
    const stored = await storeUpload(file, options);
    if (stored) accepted.push(stored);
  }
  return accepted;
}

/** Rejects anything that is not one of our own object paths. */
export function isSubmissionPath(value: string): boolean {
  return (
    /^(resumes|talent)\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i.test(value) && !value.includes('..')
  );
}

/**
 * A URL a member of staff can open, valid for a few minutes.
 *
 * Null when the file cannot be reached, so the admin shows "the file did not
 * arrive" rather than a broken link.
 */
export async function signedUploadUrl(object: string, seconds = 300): Promise<string | null> {
  if (!isSubmissionPath(object)) return null;
  if (!isSupabaseConfigured()) return null;
  const supabase = getServiceClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(object, seconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** The local development copy of a stored file. */
export async function readLocalUpload(object: string): Promise<Buffer | null> {
  if (!isSubmissionPath(object) || !isLocalDb()) return null;
  try {
    return await readFile(path.join(LOCAL_DIR, object));
  } catch {
    return null;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export function contentTypeOf(object: string): string {
  const extension = object.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
