import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { clientKey, overLimit } from '@/server/ticketing/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  hubId: z.string().uuid(),
  blockId: z.string().uuid().nullable().optional(),
  eventKind: z.enum(['view', 'display_view', 'block_click', 'event_click', 'review_click', 'reservation_click', 'ticket_click', 'social_click']),
  sessionKey: z.string().uuid().or(z.literal('')).optional(),
  referrer: z.string().max(1000).nullable().optional(),
  target: z.string().max(1000).nullable().optional(),
  utm: z.record(z.string().max(300)).optional(),
}).strict();

function deviceOf(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!userAgent) return 'unknown';
  if (/ipad|tablet|kindle/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return new NextResponse(null, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  if (await overLimit(`hub-analytics:${clientKey(request)}`, 180, 60)) return new NextResponse(null, { status: 202 });
  const db = getReadDb();
  if (!db) return new NextResponse(null, { status: 202 });
  try {
    const hub = await db.get<Row>('link_hubs', parsed.data.hubId);
    if (!hub || hub.status !== 'published') return new NextResponse(null, { status: 404 });
    if (parsed.data.blockId) {
      const block = await db.get<Row>('link_hub_blocks', parsed.data.blockId);
      if (!block || block.hub_id !== parsed.data.hubId) return new NextResponse(null, { status: 400 });
    }
    await db.insert('link_hub_analytics', {
      hub_id: parsed.data.hubId,
      block_id: parsed.data.blockId || null,
      event_kind: parsed.data.eventKind,
      session_key: parsed.data.sessionKey || null,
      referrer: parsed.data.referrer || null,
      utm: parsed.data.utm ?? {},
      device: deviceOf(request.headers.get('user-agent')),
      target: parsed.data.target || null,
      metadata: {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[link-hubs] analytics insert failed:', error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
