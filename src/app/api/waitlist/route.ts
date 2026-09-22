import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';

export const runtime = 'nodejs';

/**
 * "Tell me if tickets open up."
 *
 * One email, one event. Duplicate signups are a quiet success — the guest is
 * on the list, which is what they asked. The limiter is per instance and
 * fails open: a sold-out event's waitlist must never refuse a real guest
 * because a serverless instance was warm.
 */

const schema = z
  .object({
    eventId: z.string().min(1).max(120),
    email: z.string().trim().email().max(180),
    // Honeypot. Humans never see it.
    website: z.string().max(0).optional(),
  })
  .strict();

const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;

function limited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 1000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Enter an email address.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Enter an email address we can reach you on.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) {
    return NextResponse.json({ ok: false, message: 'That is plenty for now. Try again in a few minutes.' }, { status: 429 });
  }

  const db = getReadDb();
  if (!db) {
    return NextResponse.json({ ok: false, message: 'The waitlist is not open right now. Call us and we will add you.' }, { status: 503 });
  }

  const email = parsed.data.email.toLowerCase();
  try {
    await db.insert<Row>('waitlist', {
      id: crypto.randomUUID(),
      event_id: parsed.data.eventId,
      email,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Already on the list is a success, not an error.
    if (!/duplicate|unique|already exists/i.test(message)) {
      console.error('[waitlist] insert failed:', message);
      return NextResponse.json({ ok: false, message: 'Could not save that just now. Try again in a moment.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, message: 'You are on the list. We will email you if seats open up.' });
}
