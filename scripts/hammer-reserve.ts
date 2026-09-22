import { DEMO_MODE } from '../src/lib/demo';
/**
 * Concurrency test for `reserve_order`.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/hammer-reserve.ts
 *
 * Creates a throwaway event with one 10-seat tier, fires 50 reservations at it
 * in parallel, and asserts that exactly 10 seats were sold and every other
 * call came back TIER_SOLD_OUT. Then deletes what it made. The event row lock
 * inside reserve_order is what makes this pass; run it after any change to
 * that function.
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  if (DEMO_MODE) throw new Error('External database commands are disabled in this portfolio demo.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const eventId = `hammer-${Date.now()}`;
  const starts = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const ends = new Date(Date.now() + 7 * 86_400_000 + 3 * 3_600_000).toISOString();

  const event = await client.from('event_occurrences').insert({
    id: eventId,
    series_slug: null,
    slug: eventId,
    title: 'Hammer test',
    starts_at: starts,
    ends_at: ends,
    status: 'scheduled',
    published: true,
    ticketing_enabled: true,
    source: 'manual',
  });
  if (event.error) throw new Error(event.error.message);
  const tier = await client
    .from('ticket_tiers')
    .insert({ event_id: eventId, name: 'Seat', price_cents: 1000, capacity: 10, max_per_order: 10 })
    .select('id')
    .single();
  if (tier.error) throw new Error(tier.error.message);

  const attempts = 50;
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      client.rpc('reserve_order', {
        p_event_id: eventId,
        p_items: [{ tier_id: tier.data.id, quantity: 1 }],
        p_promo_code: null,
        p_hold_minutes: 12,
        p_source: 'web',
      }),
    ),
  );
  const ok = results.filter((result) => !result.error).length;
  const soldOut = results.filter((result) => /TIER_SOLD_OUT|EVENT_SOLD_OUT/.test(result.error?.message ?? '')).length;
  const other = results.filter((result) => result.error && !/SOLD_OUT/.test(result.error.message));

  const availability = await client.rpc('get_event_availability', { p_event_id: eventId });
  const taken = (availability.data as { taken: number } | null)?.taken;

  // Clean up: holds and items cascade from orders; orders reference the event
  // without cascade, so they go first.
  const orders = await client.from('orders').select('id').eq('event_id', eventId);
  for (const order of orders.data ?? []) await client.from('orders').delete().eq('id', order.id);
  await client.from('event_occurrences').delete().eq('id', eventId);

  console.log(`${attempts} parallel reservations: ${ok} succeeded, ${soldOut} sold out, ${other.length} other errors; seats taken = ${taken}`);
  for (const result of other.slice(0, 3)) console.log('  ', result.error?.message);
  if (ok !== 10 || taken !== 10 || other.length > 0) {
    console.error('FAILED: expected exactly 10 seats sold.');
    process.exit(1);
  }
  console.log('OK: exactly 10 seats sold, the rest refused.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
