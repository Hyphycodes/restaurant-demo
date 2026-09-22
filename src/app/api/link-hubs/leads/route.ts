import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { clientKey, overLimit } from '@/server/ticketing/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  hubId: z.string().uuid(),
  blockId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).nullable().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().or(z.literal('')).optional(),
  company: z.string().max(0).nullable().optional(),
  utm: z.record(z.string().max(300)).optional(),
}).strict();

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, message: 'Please check the form.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Enter a name and an email we can reach.' }, { status: 400 });
  if (await overLimit(`hub-lead:${clientKey(request)}`, 6, 600)) {
    return NextResponse.json({ ok: false, message: 'That is plenty for now. Try again later.' }, { status: 429 });
  }
  const db = getReadDb();
  if (!db) return NextResponse.json({ ok: false, message: 'Signup is unavailable right now.' }, { status: 503 });
  try {
    const [hub, block] = await Promise.all([
      db.get<Row>('link_hubs', parsed.data.hubId),
      db.get<Row>('link_hub_blocks', parsed.data.blockId),
    ]);
    if (!hub || hub.status !== 'published' || !block || block.hub_id !== parsed.data.hubId || block.block_type !== 'lead') {
      return NextResponse.json({ ok: false, message: 'This signup is not available.' }, { status: 404 });
    }
    const id = crypto.randomUUID();
    await db.insert('link_hub_leads', {
      id,
      hub_id: parsed.data.hubId,
      block_id: parsed.data.blockId,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      birthday: parsed.data.birthday || null,
      status: 'new',
      source: { utm: parsed.data.utm ?? {}, referrer: request.headers.get('referer') },
      created_at: new Date().toISOString(),
    });
    await db.insert('link_hub_analytics', {
      hub_id: parsed.data.hubId,
      block_id: parsed.data.blockId,
      event_kind: 'lead_submit',
      session_key: null,
      referrer: request.headers.get('referer'),
      utm: parsed.data.utm ?? {},
      device: null,
      target: null,
      metadata: { lead_id: id },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[link-hubs] lead insert failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: 'Could not save that just now. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: 'You’re on the list.' });
}
