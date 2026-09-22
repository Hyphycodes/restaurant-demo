import 'server-only';

import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Employee files: certificates, signed acknowledgements, profile photos,
 * checklist photos, incident attachments.
 *
 * They live in the private `employee-files` bucket (migration 0022). Nothing
 * in it has a public URL. The app hands out signed URLs that expire in
 * minutes, generated here after the server has checked who is asking.
 * Locally, with no Supabase, uploads are recorded by name only and the
 * "file" is a placeholder: the flow can be walked, nothing is stored.
 */

export const EMPLOYEE_FILES_BUCKET = 'employee-files';
const SIGNED_URL_SECONDS = 60 * 10;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export function employeeFilePath(employeeId: string, purpose: string, originalName: string): string {
  const safe =
    originalName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(-60) || 'file';
  return `employees/${employeeId}/${purpose}/${crypto.randomUUID()}-${safe}`;
}

export function fileProblem(file: File): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_BYTES) return 'That file is bigger than 15 MB. Take a photo of it or shrink it first.';
  if (!ALLOWED.has(file.type)) return 'Upload a PDF or a photo (JPG, PNG, HEIC).';
  return null;
}

/** Stores a file and returns its path, or the reason it could not. */
export async function storeEmployeeFile(path: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { path };
  const client = getServiceClient();
  if (!client) return { error: 'File storage is not connected.' };
  const { error } = await client.storage.from(EMPLOYEE_FILES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: 'The upload did not finish. Please try once more.' };
  return { path };
}

/** A short-lived link to a private file, or null when there is nothing to link. */
export async function signedEmployeeFileUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (!isSupabaseConfigured()) return null;
  const client = getServiceClient();
  if (!client) return null;
  const { data } = await client.storage.from(EMPLOYEE_FILES_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function removeEmployeeFile(path: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getServiceClient();
  if (!client) return;
  await client.storage.from(EMPLOYEE_FILES_BUCKET).remove([path]);
}
