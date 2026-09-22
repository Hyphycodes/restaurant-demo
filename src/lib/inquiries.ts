import { z } from 'zod';
import { venueIsoDate } from './events';
import type { InquiryType } from '@/content/types';

/**
 * Inquiry validation. Shared by the client form and the server action, so the
 * two can never disagree about what is required.
 */

const phone = z
  .string()
  .trim()
  .min(7, 'Enter a phone number we can reach you on.')
  .max(32)
  .regex(/^[\d\s()+.-]+$/, 'Use digits, spaces, and ( ) + - only.');

const base = {
  name: z.string().trim().min(2, 'Tell us your name.').max(120),
  email: z.string().trim().email('Enter an email address we can reply to.').max(180),
  phone,
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  // Bots fill hidden fields; humans do not. Must be empty.
  company_website: z.string().max(0).optional(),
};

/** Rejects a date in the past without depending on the client's clock. */
const futureDate = z
  .string()
  .trim()
  .min(1, 'Choose a date.')
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    'Choose a valid date.')
  .refine((value) => value >= venueIsoDate(new Date().toISOString()), 'Choose a date that has not already passed.');

export const cateringSchema = z.object({
  ...base,
  organization: z.string().trim().max(160).optional().or(z.literal('')),
  date: futureDate,
  time: z.string().trim().max(40).optional().or(z.literal('')),
  guests: z.coerce
    .number({ invalid_type_error: 'Enter a guest count.' })
    .int()
    .min(1, 'Enter at least 1 guest.')
    .max(1000, 'For more than 1,000 guests, please call us.'),
  fulfillment: z.enum(['pickup', 'delivery', 'not-sure']),
  packageInterest: z.string().trim().max(120).optional().or(z.literal('')),
});

export const privateEventSchema = z.object({
  ...base,
  date: futureDate,
  dateFlexible: z.coerce.boolean().optional(),
  guests: z.coerce
    .number({ invalid_type_error: 'Enter a guest count.' })
    .int()
    .min(1, 'Enter at least 1 guest.')
    .max(1000, 'For more than 1,000 guests, please call us.'),
  eventType: z.string().trim().min(1, 'Choose an event type.').max(80),
  contactPreference: z.enum(['email', 'phone', 'text']),
});

/**
 * Two forms, not three.
 *
 * `careers` is still an `InquiryType` because the database enum has it and
 * applications sent through the old form are business records that must keep
 * rendering in the admin's Enquiries inbox. Nothing produces a new one: a job
 * application now has its own table, its own statuses and its own screen. See
 * `src/lib/submissions.ts` and migration 0026.
 */
export const SCHEMAS: Partial<Record<InquiryType, z.ZodTypeAny>> = {
  catering: cateringSchema,
  'private-event': privateEventSchema,
};

export type InquiryResult =
  | { ok: true; reference: string; stored: 'database' }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

/** Short, human-quotable reference. Deterministic from the payload + timestamp. */
export function makeReference(type: InquiryType, at: Date): string {
  const prefix = { catering: 'CAT', 'private-event': 'EVT', careers: 'JOB' }[type];
  const stamp = at.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = Math.abs(
    [...`${type}${at.getTime()}`].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7),
  )
    .toString(36)
    .slice(0, 4)
    .toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}
