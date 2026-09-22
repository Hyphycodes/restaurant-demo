-- Test fixtures for ticketing: a $1 event to buy for real in Stripe test mode,
-- and one realistic night to click through.
--
--   psql "$DATABASE_URL" -f supabase/seeds/test-event.sql
--   (or paste it into the Supabase SQL editor)
--
-- Idempotent: running it twice changes nothing and creates nothing twice. The
-- ids and tier ids are fixed for exactly that reason.
--
-- BOTH EVENTS ARE SEEDED UNPUBLISHED, because this file is meant to be safe to
-- run against the live database of a working restaurant. An unpublished event
-- is invisible on the site and `reserve_order` refuses it for web sales.
--
-- To run the manual test script in docs (phase 06), publish the $1 event for as
-- long as the test takes and then put it back:
--
--   update public.event_occurrences set published = true  where id = 'test:dollar-event';
--   -- …buy a ticket, scan it, refund it…
--   update public.event_occurrences set published = false where id = 'test:dollar-event';
--
-- To remove the fixtures entirely (orders and tickets cascade with the event):
--
--   delete from public.event_occurrences where id in ('test:dollar-event', 'test:sample-saturday');

begin;

-- The publish guard is for humans editing events in the admin; seeding is not
-- that. Tolerant, so this still runs on a database without the guard.
do $$
begin
  execute 'alter table public.event_occurrences disable trigger event_occurrences_guard_publish';
exception when others then
  null;
end $$;

-- ------------------------------------------------------- Test Event — $1 ----

insert into public.event_occurrences
  (id, series_slug, slug, title, summary, description, starts_at, ends_at,
   status, published, ticketing_enabled, capacity, age_policy, fee_display,
   service_fee_flat_cents, refund_policy, venue_name)
values
  ('test:dollar-event', null, 'test-event-1-dollar', 'Test Event — $1',
   'A real purchase for a dollar, so the whole path can be tested.',
   'Not a real event. It exists so a card can be charged, a ticket emailed, and a QR scanned at the door before any of that happens to a paying guest.',
   now() + interval '14 days', now() + interval '14 days 3 hours',
   'scheduled', false, true, 20, 'all_ages', 'itemized', 100,
   'Test tickets are refunded as soon as the test is finished.',
   'Cosa Nostra')
on conflict (id) do update set
  title             = excluded.title,
  summary           = excluded.summary,
  description       = excluded.description,
  ticketing_enabled = excluded.ticketing_enabled,
  capacity          = excluded.capacity,
  fee_display       = excluded.fee_display,
  service_fee_flat_cents = excluded.service_fee_flat_cents,
  -- Dates move forward on every run so the fixture never goes stale, but
  -- `published` is deliberately NOT overwritten: if someone published it to run
  -- a test, re-seeding must not yank it out from under them.
  starts_at         = excluded.starts_at,
  ends_at           = excluded.ends_at;

insert into public.ticket_tiers
  (id, event_id, name, description, price_cents, capacity, max_per_order, sort_order, is_active)
values
  ('00000000-0000-4000-8000-000000000101', 'test:dollar-event', 'General Admission',
   'One dollar. The service fee makes the charge $2, which is what a real order looks like.',
   100, 20, 10, 0, true)
on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  price_cents   = excluded.price_cents,
  capacity      = excluded.capacity,
  max_per_order = excluded.max_per_order,
  is_active     = excluded.is_active;

-- --------------------------------------------- A realistic Saturday night ----

insert into public.event_occurrences
  (id, series_slug, slug, title, summary, description, starts_at, ends_at,
   status, published, ticketing_enabled, capacity, age_policy, fee_display,
   service_fee_flat_cents, refund_policy, venue_name)
values
  ('test:sample-saturday', null, 'sample-saturday-music-night', 'Sample Saturday Music Night',
   'Live music, two tiers, 120 seats — a night shaped like a real one.',
   'A fixture for clicking through the admin, the door and the dashboard with numbers that behave like a real Saturday: a general admission tier, a smaller VIP tier, and a cap the two of them share.',
   now() + interval '21 days', now() + interval '21 days 5 hours',
   'scheduled', false, true, 120, '21+', 'itemized', 100,
   'Tickets are non-refundable, but we will move you to another date if you ask before the event.',
   'Cosa Nostra')
on conflict (id) do update set
  title             = excluded.title,
  summary           = excluded.summary,
  description       = excluded.description,
  ticketing_enabled = excluded.ticketing_enabled,
  capacity          = excluded.capacity,
  starts_at         = excluded.starts_at,
  ends_at           = excluded.ends_at;

insert into public.ticket_tiers
  (id, event_id, name, description, price_cents, capacity, max_per_order, sort_order, is_active)
values
  ('00000000-0000-4000-8000-000000000201', 'test:sample-saturday', 'General Admission',
   'Standing room, bar open all night.', 2000, 100, 8, 0, true),
  ('00000000-0000-4000-8000-000000000202', 'test:sample-saturday', 'VIP Table',
   'A reserved table for four. Counts as four seats against the room.', 12000, 5, 2, 1, true)
on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  price_cents   = excluded.price_cents,
  capacity      = excluded.capacity,
  max_per_order = excluded.max_per_order,
  is_active     = excluded.is_active;

-- A table admits four people, so it must consume four seats of the room.
update public.ticket_tiers
   set seats_per_ticket = 4
 where id = '00000000-0000-4000-8000-000000000202';

-- A promoter's code on the sample night: discounts nothing, attributes everything.
insert into public.promo_codes (code, event_id, kind, value, promoter_name, is_active)
values ('SAMPLEPROMO', 'test:sample-saturday', 'tracking_only', 0, 'Sample Promoter', true)
on conflict (upper(code), coalesce(event_id, '')) do update set
  promoter_name = excluded.promoter_name,
  is_active     = excluded.is_active;

do $$
begin
  execute 'alter table public.event_occurrences enable trigger event_occurrences_guard_publish';
exception when others then
  null;
end $$;

commit;
