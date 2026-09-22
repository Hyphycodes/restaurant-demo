'use server';

import { getReadDb, isLocalDb } from '@/lib/db';
import type { InquiryType } from '@/content/types';
import { makeReference, SCHEMAS, type InquiryResult } from '@/lib/inquiries';
import { rateLimited, RATE_LIMIT_MESSAGE, requestFingerprint } from '@/server/rate-limit';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Inquiry submission.
 *
 * Honesty rules enforced here:
 *  - Success requires durable database persistence. Failure asks guests to retry or call.
 *  - NOTHING claims email notification anywhere, because no mailer is configured.
 *    See docs/ENVIRONMENT.md.
 */

export async function submitInquiry(type: InquiryType, formData: FormData): Promise<InquiryResult> {
  const schema = SCHEMAS[type];
  if (!schema) return { ok: false, fieldErrors: {}, formError: 'Choose a valid inquiry form.' };
  const raw = Object.fromEntries(formData.entries());

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      // Honeypot: report a generic failure rather than naming the trap field.
      if (key === 'company_website') {
        return { ok: false, fieldErrors: {}, formError: 'Something went wrong. Please try again.' };
      }
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  if (rateLimited(`${type}:${await requestFingerprint()}`)) {
    return { ok: false, fieldErrors: {}, formError: RATE_LIMIT_MESSAGE };
  }

  const data = parsed.data as Record<string, unknown>;
  const { name, email, phone, company_website: _trap, ...payload } = data;
  void _trap;

  const reference = makeReference(type, new Date());

  try {
  if (isLocalDb()) {
    await getReadDb()!.insert('inquiries', { id: crypto.randomUUID(), type, name, email, phone, payload, reference, status: 'new', created_at: new Date().toISOString() });
    return { ok: true, reference, stored: 'database' };
  }
  if (isSupabaseConfigured()) {
    const supabase = getServiceClient();
    if (supabase) {
      const { error } = await supabase
        .from('inquiries')
        .insert({ type, name, email, phone, payload, reference, status: 'new' });

      if (!error) return { ok: true, reference, stored: 'database' };
      console.error('[inquiry] insert failed:', error.message);
    }
  }

  } catch {
    console.error('[inquiry] storage unavailable');
  }
  return { ok: false, fieldErrors: {}, formError: 'Your message could not be saved. Please try again or call (312) 555-0147. Your details are still in the form.' };
}
