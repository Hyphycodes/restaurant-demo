import { DEMO_MODE } from '../src/lib/demo';


import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { venueLocalIso } from '../src/lib/events';
import { buildRecords } from '../src/server/migration/records';

function inDays(days: number, minutes: number): string {
  const day = new Date(Date.now() + days * 86_400_000);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day);
  const [y, m, d] = iso.split('-').map(Number);
  return venueLocalIso(y!, m!, d!, minutes);
}

export const SAMPLE_EVENTS = [
  {
    id: 'sample-listening-night',
    series_slug: null,
    slug: 'sample-listening-night',
    title: 'Sample Vinyl & Vermouth Night',
    summary: 'Two hours of listening, drinks in hand. Aperitivo included.',
    description:
      'A sample event for development. Every seat includes aperitivo and antipasti; the kitchen and the bar are open throughout.\n\nArrive fifteen minutes early to pick a seat. Parking is free behind the building.',
    starts_at: inDays(9, 19 * 60),
    ends_at: inDays(9, 22 * 60),
    status: 'scheduled',
    ticketing_enabled: true,
    capacity: 40,
    age_policy: 'all_ages',
    refund_policy: 'Full refund up to 48 hours before. After that we will move you to another date.',
    fee_display: 'inclusive',
    published: true,
    archived_at: null,
    draft: null,
    age_min: null,
    music_formats: [],
    venue_name: 'Cosa Nostra',
    price_cents: 1000,
    ticket_url: 'https://example.invalid/demo',
    flyer_asset_id: null,
    category: 'vinyl-vermouth',
    visual_preset: 'candy',
    treatment: 'standard',
    featured: false,
    priority: 0,
    source: 'manual',
  },
  {
    id: 'sample-free-night',
    series_slug: null,
    slug: 'sample-free-night',
    title: 'Sample Free Night',
    summary: 'No ticket, no cover. Music from nine.',
    description: 'A sample free event for development. Come in, grab a table and settle in.',
    starts_at: inDays(12, 21 * 60),
    ends_at: inDays(12, 26 * 60),
    status: 'free',
    published: true,
    archived_at: null,
    draft: null,
    age_min: 21,
    music_formats: ['Soul', 'Disco'],
    venue_name: 'Cosa Nostra',
    price_cents: 0,
    ticket_url: null,
    flyer_asset_id: null,
    category: 'nightlife',
    visual_preset: 'neon',
    treatment: 'standard',
    featured: false,
    priority: 0,
    source: 'manual',
  },
];

export const SAMPLE_TIERS = [
  { id: '11111111-1111-4111-8111-000000000001', event_id: 'sample-listening-night', name: 'Adult', description: 'Aperitivo and a shared antipasti course.', price_cents: 1000, capacity: 30, seats_per_ticket: 1, min_per_order: 0, max_per_order: 8, sort_order: 0, is_active: true },
  { id: '11111111-1111-4111-8111-000000000002', event_id: 'sample-listening-night', name: 'Alcohol-free admission', description: 'Alcohol-free aperitivo and antipasti.', price_cents: 600, capacity: 10, seats_per_ticket: 1, min_per_order: 0, max_per_order: 6, sort_order: 1, is_active: true },
];

async function seedSupabase(url: string, key: string) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const events = await client.from('event_occurrences').upsert(SAMPLE_EVENTS, { onConflict: 'id' });
  if (events.error) throw new Error(events.error.message);
  const tiers = await client.from('ticket_tiers').upsert(SAMPLE_TIERS, { onConflict: 'id' });
  if (tiers.error) throw new Error(tiers.error.message);

  // Sell most of the Adult tier so "n of 40 left" shows. Reserve, then
  // fulfil, through the same functions checkout uses — never a raw insert.
  const availability = await client.rpc('get_event_availability', { p_event_id: 'sample-listening-night' });
  const adult = (availability.data?.tiers as { tier_id: string; taken: number }[] | undefined)?.find(
    (tier) => tier.tier_id === SAMPLE_TIERS[0]!.id,
  );
  const toSell = Math.max(0, 27 - (adult?.taken ?? 0));
  for (let sold = 0; sold < toSell; ) {
    const quantity = Math.min(3, toSell - sold);
    const reserved = await client.rpc('reserve_order', {
      p_event_id: 'sample-listening-night',
      p_items: [{ tier_id: SAMPLE_TIERS[0]!.id, quantity }],
      p_promo_code: null,
      p_hold_minutes: 12,
      p_source: 'import',
    });
    if (reserved.error) throw new Error(reserved.error.message);
    const orderId = (reserved.data as { order_id: string }).order_id;
    await client.from('orders').update({ customer_name: 'Sample Guest', customer_email: `sample+${sold}@example.com` }).eq('id', orderId);
    const fulfilled = await client.rpc('fulfill_order', { p_order_id: orderId, p_charge_id: null, p_paid_at: new Date().toISOString() });
    if (fulfilled.error) throw new Error(fulfilled.error.message);
    sold += quantity;
  }
  console.log(`Seeded ${SAMPLE_EVENTS.length} sample events, ${SAMPLE_TIERS.length} tiers and ${toSell} sample seats into Supabase.`);
}

async function seedLocal() {
  const dir = path.join(process.cwd(), '.cosa-nostra-local');
  const file = path.join(dir, 'content.json');
  await mkdir(dir, { recursive: true });
  let tables: Record<string, Record<string, unknown>[]> = {};
  try {
    tables = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // First run: start from the same seed the dev server would have written.
    tables = buildRecords().tables as Record<string, Record<string, unknown>[]>;
  }
  const upsert = (table: string, samples: Record<string, unknown>[]) => {
    const rows = (tables[table] ??= []);
    for (const sample of samples) {
      const index = rows.findIndex((row) => row.id === sample.id);
      const stamped = { ...sample, updated_at: new Date().toISOString() };
      if (index === -1) rows.push(stamped);
      else rows[index] = { ...rows[index], ...stamped };
    }
  };
  upsert('event_occurrences', SAMPLE_EVENTS);
  upsert('ticket_tiers', SAMPLE_TIERS);
  await writeFile(file, JSON.stringify(tables, null, 2), 'utf8');
  console.log(`Seeded ${SAMPLE_EVENTS.length} sample events into ${path.relative(process.cwd(), file)}.`);
}

async function main() {
  if (DEMO_MODE) throw new Error('External database commands are disabled in this portfolio demo.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) await seedSupabase(url, key);
  else await seedLocal();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
