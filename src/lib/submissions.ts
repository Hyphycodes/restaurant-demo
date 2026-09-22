import { z } from 'zod';
import { isTalentDiscipline, type TalentDiscipline } from '@/content/talent';



/* ------------------------------------------------------------ normalising -- */

/** A US number as `(312) 555-0147`, or the trimmed input when it is not one. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw.trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}


export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim().replace(/[),.]+$/, '');
  if (!trimmed) return null;
  // A bare @handle has no home without a platform, so it is kept as text
  // elsewhere (the pitch), not turned into a guessed URL.
  if (trimmed.startsWith('@')) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // A hostname with no dot is a typo, not a website.
  if (!url.hostname.includes('.')) return null;
  url.protocol = 'https:';
  return url.toString();
}

export const MAX_LINKS = 8;

/** A textarea of pasted links → a de-duplicated list of absolute URLs. */
export function parseLinks(raw: string): string[] {
  const seen = new Set<string>();
  for (const piece of raw.split(/[\s,]+/)) {
    const link = normalizeLink(piece);
    if (link) seen.add(link);
    if (seen.size >= MAX_LINKS) break;
  }
  return [...seen];
}

/* ----------------------------------------------------------------- limits -- */

/**
 * What may be uploaded.
 *
 * A résumé is usually a PDF and sometimes a photograph of one, so both are
 * accepted. Talent media is images only — a video belongs in a link, where it
 * already has a player and a thumbnail, and where nobody waits on a 200MB
 * upload over a phone connection.
 */
export const RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const RESUME_MAX_BYTES = 8 * 1024 * 1024;
export const RESUME_HINT = 'PDF, Word or a photo, up to 8MB.';

export const TALENT_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const TALENT_MEDIA_MAX_FILES = 4;
export const TALENT_MEDIA_MAX_BYTES = 6 * 1024 * 1024;
export const TALENT_MEDIA_HINT = 'Up to 4 photos, 6MB each. Video is better as a link.';

/** The file extension to store a given upload under. Never the client's name. */
export function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  return map[mime] ?? 'bin';
}

/** A person-facing file name, stripped of anything that is not one. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[/\\]/g, '-')
      .trim()
      .slice(0, 120) || 'attachment'
  );
}

/* ---------------------------------------------------------------- schemas -- */

const name = z.string().trim().min(2, 'Tell us your name.').max(120);
const email = z.string().trim().email('Enter an email address we can reply to.').max(180);
const phone = z
  .string()
  .trim()
  .min(7, 'Enter a phone number we can reach you on.')
  .max(32)
  .regex(/^[\d\s()+.\-x]+$/i, 'Use digits, spaces, and ( ) + - only.');
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

/** Bots fill hidden fields; humans do not. Must be empty. */
const honeypot = z.string().max(0).optional();

/**
 * `openingId` is the id of an active opening, or the literal `open` for
 * "something else". The job TITLE is never taken from the form: the server
 * looks the opening up and stores its real title, so a posted `position` of
 * "General Manager" cannot invent a job nobody advertised.
 */
export const OPEN_APPLICATION_ID = 'open';

export const applicationSchema = z.object({
  name,
  email,
  phone,
  openingId: z.string().trim().min(1, 'Choose what you are applying for.').max(64),
  availability: z
    .string()
    .trim()
    .min(2, 'Roughly when can you work? A few words is plenty.')
    .max(600),
  experience: optionalText(1200),
  notes: optionalText(1200),
  company_website: honeypot,
});

export const talentSchema = z
  .object({
    name,
    email: z.string().trim().max(180).optional().or(z.literal('')),
    phone: z.string().trim().max(32).optional().or(z.literal('')),
    discipline: z
      .string()
      .trim()
      .refine((value): value is TalentDiscipline => isTalentDiscipline(value), 'Pick the closest one.'),
    pitch: z.string().trim().min(2, 'Tell us what you do.').max(600),
    links: optionalText(1200),
    idea: optionalText(600),
    notes: optionalText(600),
    company_website: honeypot,
  })
  // One way to reach them is the only hard requirement. Somebody who left a
  // phone number and an Instagram handle has told us enough.
  .refine((value) => Boolean(value.email?.trim() || value.phone?.trim()), {
    message: 'Leave an email or a phone number so we can get back to you.',
    path: ['email'],
  })
  .refine((value) => !value.email?.trim() || z.string().email().safeParse(value.email.trim()).success, {
    message: 'That email address does not look right.',
    path: ['email'],
  })
  .refine((value) => !value.phone?.trim() || /^[\d\s()+.\-x]{7,32}$/i.test(value.phone.trim()), {
    message: 'Use digits, spaces, and ( ) + - only.',
    path: ['phone'],
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type TalentInput = z.infer<typeof talentSchema>;

/* ----------------------------------------------------------------- result -- */

/**
 * What a public form gets back.
 *
 * `emailed` is the truth about the confirmation, not a hope: guest delivery is
 * switched off until somebody turns it on, and the success panel must not
 * promise an email that was never sent. See docs/email-system.md.
 */
export type SubmissionResult =
  | { ok: true; reference: string; emailed: boolean }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

/** Short, human-quotable. Same shape as an enquiry reference. */
export function makeReference(prefix: 'JOB' | 'TAL', at: Date): string {
  const stamp = at.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = Math.abs(
    [...`${prefix}${at.getTime()}${Math.random()}`].reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
      7,
    ),
  )
    .toString(36)
    .slice(0, 4)
    .toUpperCase()
    .padStart(4, '0');
  return `${prefix}-${stamp}-${suffix}`;
}
