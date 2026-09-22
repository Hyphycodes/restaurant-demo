'use server';

import { z } from 'zod';
import type { Row } from '@/lib/db/types';
import { done, run, type ActionState } from './shared';

/**
 * Business details, hours, and date-specific exceptions.
 *
 * These live once. The homepage, /visit, the footer, the structured data and the
 * calendar links all read the same record, which is why they cannot disagree —
 * and why a change here revalidates every route that carries a footer.
 */

const httpsOnly = z
  .string()
  .trim()
  .refine((value) => !value || /^https:\/\/\S+$/i.test(value), {
    message: 'Links have to start with https://',
  });

const detailsSchema = z.object({
  phone: z.string().trim().min(7, 'Enter the phone number guests should call.').max(24),
  street: z.string().trim().min(1).max(120),
  locality: z.string().trim().min(1).max(80),
  region: z.string().trim().min(2).max(4),
  postalCode: z.string().trim().min(3).max(12),
  orderUrl: httpsOnly,
  reservationUrl: httpsOnly,
  cateringOrderUrl: httpsOnly,
  directionsUrl: httpsOnly,
  facebook: httpsOnly,
  instagram: httpsOnly,
  tiktok: httpsOnly.optional(),
});

export async function saveBusinessDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('settings.manage', async ({ db }) => {
    const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: issue?.message ?? 'Please check the details.' };
    }

    const value = parsed.data;
    const existing = await db.get<Row>('site_settings', 'default');
    const payload = { ...((existing?.payload as Record<string, unknown>) ?? {}) };

    // `provisional: false` is meaningful: these values were flagged as disputed
    // between the website and Demo ordering, and a human confirming them here settles it.
    payload.phone = { value: value.phone, provisional: false };
    payload.street = value.street;
    payload.locality = value.locality;
    payload.region = value.region.toUpperCase();
    payload.postalCode = value.postalCode;
    if (value.orderUrl) payload.orderUrl = value.orderUrl;
    if (value.reservationUrl) payload.reservationUrl = value.reservationUrl;
    if (value.cateringOrderUrl) payload.cateringOrderUrl = value.cateringOrderUrl;
    if (value.directionsUrl) payload.directionsUrl = value.directionsUrl;

    const socials: { platform: string; handle: string; url: string }[] = [];
    if (value.tiktok) socials.push({ platform: 'tiktok', handle: `@${handleOf(value.tiktok).replace(/^@/, '')}`, url: value.tiktok });
    if (value.facebook) {
      socials.push({ platform: 'facebook', handle: handleOf(value.facebook), url: value.facebook });
    }
    if (value.instagram) {
      socials.push({
        platform: 'instagram',
        handle: `@${handleOf(value.instagram)}`,
        url: value.instagram,
      });
    }
    if (socials.length) payload.socials = socials;

    await db.upsert('site_settings', { id: 'default', payload });
    return done('Saved. These details update everywhere on the website.', 'settings');
  });
}

function handleOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/|\/$/g, '') || url;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ hours */

const hoursSchema = z.object({ hours: z.string().min(2) });

export async function saveHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('settings.manage', async ({ db }) => {
    const parsed = hoursSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not read the hours.' };

    let entries: { day: number; closed: boolean; open: string; close: string }[];
    try {
      entries = JSON.parse(parsed.data.hours);
    } catch {
      return { ok: false, message: 'Could not read the hours.' };
    }

    const toMinutes = (value: string) => {
      const [h, m] = value.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };

    const hours = entries.map((day) => {
      const openMinutes = toMinutes(day.open);
      let closeMinutes = toMinutes(day.close);
      // A close time at or before the open time means it closes after midnight.
      if (closeMinutes <= openMinutes) closeMinutes += 1440;
      return {
        day: day.day,
        closed: day.closed,
        ranges: day.closed ? [] : [{ openMinutes, closeMinutes }],
      };
    });

    const existing = await db.get<Row>('site_settings', 'default');
    const payload = {
      ...((existing?.payload as Record<string, unknown>) ?? {}),
      hours: { value: hours, provisional: false },
    };

    await db.upsert('site_settings', { id: 'default', payload });
    return done('Hours updated on the website.', 'settings');
  });
}

/* --------------------------------------------------------- special hours */

const exceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  closed: z.coerce.boolean(),
  open: z.string().max(5),
  close: z.string().max(5),
  note: z.string().trim().min(1, 'Say what the day is — guests see this.').max(120),
});

/**
 * A one-off change to the schedule: a holiday, a private buyout, a late open.
 * Past dates fall out of the public read automatically, so nobody has to
 * remember to tidy up last Christmas.
 */
export async function saveSpecialDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('settings.manage', async ({ db }) => {
    const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the day.' };
    }

    const value = parsed.data;
    const toMinutes = (input: string) => {
      const [h, m] = input.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };

    let ranges: { openMinutes: number; closeMinutes: number }[] = [];
    if (!value.closed) {
      if (!/^\d{2}:\d{2}$/.test(value.open) || !/^\d{2}:\d{2}$/.test(value.close)) {
        return { ok: false, message: 'Enter both times, or tick “closed all day”.' };
      }
      const openMinutes = toMinutes(value.open);
      let closeMinutes = toMinutes(value.close);
      if (closeMinutes <= openMinutes) closeMinutes += 1440;
      ranges = [{ openMinutes, closeMinutes }];
    }

    await db.upsert('special_hours', {
      id: value.date,
      on_date: value.date,
      closed: value.closed,
      ranges,
      note: value.note,
    });

    return done('Saved. Guests will see this on the day.', 'settings');
  });
}

const removeSchema = z.object({ id: z.string().min(1) });

export async function removeSpecialDay(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('settings.manage', async ({ db }) => {
    const parsed = removeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not remove that day.' };
    await db.remove('special_hours', parsed.data.id);
    return done('Removed. Normal hours apply again.', 'settings');
  });
}

/* ---------------------------------------------------------- announcement */

const announcementSchema = z
  .object({
    id: z.string().optional(),
    message: z.string().trim().min(1, 'Write the message.').max(240),
    href: httpsOnly,
    linkLabel: z.string().trim().max(40),
    enabled: z.coerce.boolean(),
    tone: z.enum(['default', 'night']),
  })
  .refine((v) => !v.href || v.linkLabel.length > 0, {
    message: 'A link needs button text.',
    path: ['linkLabel'],
  });

export async function saveAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
    }

    const value = parsed.data;
    const row: Row = {
      id: value.id || crypto.randomUUID(),
      message: value.message,
      href: value.href || null,
      link_label: value.href ? value.linkLabel : null,
      starts_at: null,
      ends_at: null,
      enabled: value.enabled,
      tone: value.tone,
    };

    await db.upsert('announcements', row);
    return done(
      value.enabled ? 'The banner is live on every page.' : 'Saved. The banner is switched off.',
      'settings',
    );
  });
}
