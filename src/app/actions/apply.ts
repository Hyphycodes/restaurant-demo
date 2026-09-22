'use server';

import { OPEN_APPLICATION } from '@/content/careers';
import { DEFAULT_LOCATION } from '@/content/locations';
import { serviceTypeFor, type TalentDiscipline } from '@/content/talent';
import { getReadDb, isLocalDb } from '@/lib/db';
import {
  applicationSchema,
  makeReference,
  normalizeEmail,
  normalizePhone,
  parseLinks,
  RESUME_MAX_BYTES,
  RESUME_TYPES,
  TALENT_MEDIA_MAX_BYTES,
  TALENT_MEDIA_MAX_FILES,
  TALENT_MEDIA_TYPES,
  talentSchema,
  type SubmissionResult,
} from '@/lib/submissions';
import { getPublicOpenings } from '@/server/content/hiring';
import { emailService } from '@/server/email/service';
import { rateLimited, RATE_LIMIT_MESSAGE, requestFingerprint } from '@/server/rate-limit';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { storeUpload, storeUploads } from '@/server/uploads';

/**
 * "I want to work here" and "here is what I do".
 *
 * Both follow the same three rules as the enquiry action next door:
 *
 *   1. SUCCESS MEANS STORED. The confirmation panel appears only after the row
 *      is durably in the database. If it could not be saved, the person is
 *      told to call, and their answers stay in the form.
 *   2. NOTHING CLAIMS AN EMAIL IT DID NOT SEND. The result carries whether the
 *      confirmation actually went out, because guest delivery ships switched
 *      off (docs/email-system.md) and a success panel promising an email that
 *      was never sent is a lie the guest discovers an hour later.
 *   3. AN ATTACHMENT NEVER COSTS SOMEBODY THEIR APPLICATION. If the résumé
 *      fails to store, the application is still saved and the admin says the
 *      file did not arrive.
 */

/**
 * Writing a row a stranger just created.
 *
 * Deliberately NOT `db.insert()`, which is the admin's write path and ends in
 * `.select().single()`. A public submission is inserted by `anon`, and `anon`
 * may insert into these tables but may never read them back (migration 0026) —
 * so asking Postgres to RETURN the row is refused, and an application that was
 * really stored would be reported to the person as a failure.
 *
 * Nothing here needs the row back, so nothing asks for it.
 *
 * Returns false when there is nowhere to write: production with no database
 * configured, which the form reports honestly rather than pretending.
 */
async function storeSubmission(table: string, row: Record<string, unknown>): Promise<boolean> {
  if (isLocalDb()) {
    const db = getReadDb();
    if (!db) return false;
    // The local file database has no column defaults, so the two Postgres
    // supplies have to be supplied here or the admin shows a row with no id
    // and no date.
    await db.insert(table, { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row });
    return true;
  }

  if (!isSupabaseConfigured()) return false;
  const supabase = getServiceClient();
  if (!supabase) return false;

  const { error } = await supabase.from(table).insert(row);
  if (error) {
    console.error(`[apply] ${table} insert failed:`, error.message);
    return false;
  }
  return true;
}

const UNAVAILABLE =
  'Your message could not be saved just now. Please try again in a moment, or call us — your answers are still here.';

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]): {
  fieldErrors: Record<string, string>;
  trapped: boolean;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (key === 'company_website') return { fieldErrors: {}, trapped: true };
    fieldErrors[key] ??= issue.message;
  }
  return { fieldErrors, trapped: false };
}

/* --------------------------------------------------------- job application */

export async function submitApplication(formData: FormData): Promise<SubmissionResult> {
  const parsed = applicationSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    openingId: formData.get('openingId') ?? '',
    availability: formData.get('availability') ?? '',
    experience: formData.get('experience') ?? '',
    notes: formData.get('notes') ?? '',
    company_website: formData.get('company_website') ?? '',
  });

  if (!parsed.success) {
    const { fieldErrors, trapped } = fieldErrorsFrom(parsed.error.issues);
    if (trapped) return { ok: false, fieldErrors: {}, formError: 'Something went wrong. Please try again.' };
    return { ok: false, fieldErrors };
  }

  if (rateLimited(`apply:${await requestFingerprint()}`)) {
    return { ok: false, fieldErrors: {}, formError: RATE_LIMIT_MESSAGE };
  }

  // The opening is re-read on the server: the position a form posts is a label
  // anybody can type, and an application must say what it was really for.
  const openings = await getPublicOpenings();
  const opening = openings.find((entry) => entry.id === parsed.data.openingId) ?? null;
  const position = opening?.title ?? OPEN_APPLICATION;

  const resume = await storeUpload(formData.get('resume') as File, {
    folder: 'resumes',
    allowedTypes: RESUME_TYPES,
    maxBytes: RESUME_MAX_BYTES,
  });

  const reference = makeReference('JOB', new Date());
  const email = normalizeEmail(parsed.data.email);
  const phone = normalizePhone(parsed.data.phone);

  const stored = await storeSubmission('job_applications', {
    reference,
    opening_id: opening?.id ?? null,
    position,
    location_id: opening?.locationId ?? DEFAULT_LOCATION.id,
    name: parsed.data.name,
    email,
    phone,
    availability: parsed.data.availability,
    experience: parsed.data.experience || null,
    resume_path: resume?.path ?? null,
    resume_name: resume?.name ?? null,
    notes: parsed.data.notes || null,
    status: 'new',
  }).catch((error: unknown) => {
    console.error('[apply] could not save an application:', error);
    return false;
  });
  if (!stored) return { ok: false, fieldErrors: {}, formError: UNAVAILABLE };

  const emailed = await notify(() =>
    emailService.sendApplicationReceived({ name: parsed.data.name, email, position, reference }),
  );
  void notifyInternal('application', `${parsed.data.name} — ${position}`, [
    ['Position', position],
    ['Phone', phone],
    ['Email', email],
    ['Available', parsed.data.availability],
    ['Résumé', resume ? resume.name : 'none attached'],
  ]);

  return { ok: true, reference, emailed };
}

/* ------------------------------------------------------- talent submission */

export async function submitTalent(formData: FormData): Promise<SubmissionResult> {
  const parsed = talentSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    discipline: formData.get('discipline') ?? '',
    pitch: formData.get('pitch') ?? '',
    links: formData.get('links') ?? '',
    idea: formData.get('idea') ?? '',
    notes: formData.get('notes') ?? '',
    company_website: formData.get('company_website') ?? '',
  });

  if (!parsed.success) {
    const { fieldErrors, trapped } = fieldErrorsFrom(parsed.error.issues);
    if (trapped) return { ok: false, fieldErrors: {}, formError: 'Something went wrong. Please try again.' };
    return { ok: false, fieldErrors };
  }

  if (rateLimited(`talent:${await requestFingerprint()}`)) {
    return { ok: false, fieldErrors: {}, formError: RATE_LIMIT_MESSAGE };
  }

  const media = await storeUploads(formData.getAll('media').filter(isFile), {
    folder: 'talent',
    allowedTypes: TALENT_MEDIA_TYPES,
    maxBytes: TALENT_MEDIA_MAX_BYTES,
    maxFiles: TALENT_MEDIA_MAX_FILES,
  });

  const reference = makeReference('TAL', new Date());
  const email = parsed.data.email?.trim() ? normalizeEmail(parsed.data.email) : null;
  const phone = parsed.data.phone?.trim() ? normalizePhone(parsed.data.phone) : null;
  const links = parseLinks(parsed.data.links ?? '');
  const discipline = parsed.data.discipline as TalentDiscipline;

  const stored = await storeSubmission('talent_submissions', {
    reference,
    name: parsed.data.name,
    email,
    phone,
    discipline,
    pitch: parsed.data.pitch,
    links,
    media_paths: media.map((file) => file.path),
    idea: parsed.data.idea || null,
    notes: parsed.data.notes || null,
    location_id: DEFAULT_LOCATION.id,
    status: 'new',
  }).catch((error: unknown) => {
    console.error('[apply] could not save a talent submission:', error);
    return false;
  });
  if (!stored) return { ok: false, fieldErrors: {}, formError: UNAVAILABLE };

  const emailed = email
    ? await notify(() =>
        emailService.sendTalentReceived({ name: parsed.data.name, email, pitch: parsed.data.pitch, reference }),
      )
    : false;
  void notifyInternal('talent', `${parsed.data.name} — ${parsed.data.pitch.slice(0, 60)}`, [
    ['Does', parsed.data.pitch],
    ['Books as', serviceTypeFor(discipline)],
    ['Reach them', [phone, email].filter(Boolean).join(' · ') || 'no contact given'],
    ['Links', links.length ? links.join('\n') : 'none'],
    ['Photos', media.length ? `${media.length} attached` : 'none'],
  ]);

  return { ok: true, reference, emailed };
}

/* ------------------------------------------------------------------ email */

function isFile(value: FormDataEntryValue): value is File {
  return value instanceof File;
}

/**
 * Send, and never let the mailer decide whether a submission succeeded.
 *
 * The row is already saved by the time this runs. A Resend outage must not
 * turn a stored application into an error message.
 */
async function notify(send: () => Promise<{ status: string }>): Promise<boolean> {
  try {
    const result = await send();
    return result.status === 'sent';
  } catch (error) {
    console.error('[apply] confirmation email failed:', error);
    return false;
  }
}


async function notifyInternal(
  kind: 'application' | 'talent',
  headline: string,
  facts: [string, string][],
): Promise<void> {
  try {
    await emailService.sendSubmissionAlert({ kind, headline, facts });
  } catch (error) {
    console.error('[apply] internal notice failed:', error);
  }
}
