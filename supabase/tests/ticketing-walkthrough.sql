-- The ticketing walkthrough: the acceptance criteria of phase 01, as SQL.
--
--   psql "$DATABASE_URL" -f supabase/tests/ticketing-walkthrough.sql
--   (or paste it into the Supabase SQL editor)
--
-- It proves, in one transaction that is ALWAYS ROLLED BACK at the end:
--
--   1. an order can be created and four tickets issued from it
--   2. every ticket code is distinct
--   3. a ticket checks in once — and the second attempt changes nothing
--      (first scan wins; this is exactly what the scanner relies on)
--   4. a ticket belongs to its own event and can be told apart from another
--   5. replaying fulfilment mints nothing (a duplicate webhook is harmless)
--   6. a paid order creates a customer, and a second order by the same person
--      does not create a second one
--   7. a tracking-only promo code attributes the sale and discounts nothing
--   8. anonymous callers can read no orders, tickets or customers
--
-- Every check is an `assert`. Silence means everything passed; a failure names
-- the rule it broke. Nothing here is left behind: the rollback at the bottom
-- removes the two events, the order, the tickets and the customer.

begin;

-- The publish guard is for humans editing events in the admin, not for a test
-- fixture. Same approach as migration 0014, but tolerant: an older database
-- that does not have the guard should still be able to run the walkthrough.
do $$
begin
  execute 'alter table public.event_occurrences disable trigger event_occurrences_guard_publish';
exception when others then
  null;
end $$;

do $$
declare
  ev_a          text := 'test:walkthrough-a';
  ev_b          text := 'test:walkthrough-b';
  tier_a        uuid;
  tier_b        uuid;
  reserved      jsonb;
  fulfilled     jsonb;
  v_order       uuid;
  v_promo_order uuid;
  v_first       uuid;
  touched       int;
  n             int;
begin
  ---------------------------------------------------------------- fixtures --
  insert into public.event_occurrences
    (id, series_slug, slug, title, summary, description, starts_at, ends_at,
     published, ticketing_enabled, capacity, fee_display, service_fee_flat_cents)
  values
    (ev_a, null, 'walkthrough-a', 'Walkthrough A', 'Fixture', 'Fixture',
     now() + interval '2 days', now() + interval '2 days 3 hours', true, true, 50, 'itemized', 100),
    (ev_b, null, 'walkthrough-b', 'Walkthrough B', 'Fixture', 'Fixture',
     now() + interval '3 days', now() + interval '3 days 3 hours', true, true, 50, 'itemized', 100);

  insert into public.ticket_tiers (event_id, name, price_cents, capacity, max_per_order)
       values (ev_a, 'General Admission', 1000, 50, 10) returning id into tier_a;
  insert into public.ticket_tiers (event_id, name, price_cents, capacity, max_per_order)
       values (ev_b, 'General Admission', 1000, 50, 10) returning id into tier_b;

  ------------------------------------------------- 1. order and issuance --
  reserved := public.reserve_order(
    ev_a,
    jsonb_build_array(jsonb_build_object('tier_id', tier_a, 'quantity', 4)),
    null, 12, 'web'
  );
  v_order := (reserved ->> 'order_id')::uuid;
  assert v_order is not null, 'reserve_order returned no order';
  assert (reserved ->> 'total_cents')::int = 4100,
    format('four $10 tickets plus the $1 fee should total 4100, got %s', reserved ->> 'total_cents');

  -- Who is buying. In the real flow this arrives from the checkout page just
  -- before payment is confirmed.
  update public.orders
     set customer_name = 'Walk Through', customer_email = 'walkthrough@example.com'
   where id = v_order;

  fulfilled := public.fulfill_order(v_order, 'ch_walkthrough', now());
  assert (fulfilled ->> 'minted')::int = 4,
    format('four tickets should have been minted, got %s', fulfilled ->> 'minted');

  select count(*) into n from public.tickets where order_id = v_order;
  assert n = 4, format('the order should hold four tickets, holds %s', n);

  ------------------------------------------------------ 2. distinct codes --
  select count(distinct code) into n from public.tickets where order_id = v_order;
  assert n = 4, 'every ticket must carry its own code';

  --------------------------------------------- 3. first scan wins, twice --
  select id into v_first from public.tickets where order_id = v_order order by seq limit 1;

  update public.tickets
     set status = 'checked_in', checked_in_at = now(), checked_in_by = 'walkthrough'
   where id = v_first and checked_in_at is null;
  get diagnostics touched = row_count;
  assert touched = 1, 'the first check-in should take';

  -- The scanner's second scan is the same conditional update. Zero rows is
  -- what it reads as "already checked in".
  update public.tickets
     set status = 'checked_in', checked_in_at = now(), checked_in_by = 'walkthrough-again'
   where id = v_first and checked_in_at is null;
  get diagnostics touched = row_count;
  assert touched = 0, 'a second check-in must change nothing';

  select count(*) into n from public.tickets
   where order_id = v_order and status = 'checked_in';
  assert n = 1, format('exactly one ticket should be checked in, found %s', n);

  --------------------------------------------------------- 4. wrong event --
  select count(*) into n from public.tickets where id = v_first and event_id = ev_b;
  assert n = 0, 'a ticket for one event must never resolve against another';

  ------------------------------------------------- 5. fulfilment is idempotent --
  fulfilled := public.fulfill_order(v_order, 'ch_walkthrough', now());
  assert (fulfilled ->> 'minted')::int = 0, 'a replayed fulfilment must mint nothing';
  select count(*) into n from public.tickets where order_id = v_order;
  assert n = 4, format('the order should still hold four tickets, holds %s', n);

  ------------------------------------------------------------ 6. customer --
  select count(*) into n from public.customers where email = 'walkthrough@example.com';
  assert n = 1, 'a paid order should have created exactly one customer';
  select count(*) into n from public.orders
   where id = v_order and customer_id is not null;
  assert n = 1, 'the paid order should be linked to that customer';

  -- The same person, a second night. Still one customer.
  reserved := public.reserve_order(
    ev_b, jsonb_build_array(jsonb_build_object('tier_id', tier_b, 'quantity', 1)), null, 12, 'web');
  update public.orders
     set customer_name = 'Walk Through', customer_email = 'WalkThrough@Example.com'
   where id = (reserved ->> 'order_id')::uuid;
  perform public.fulfill_order((reserved ->> 'order_id')::uuid, null, now());
  select count(*) into n from public.customers where email = 'walkthrough@example.com';
  assert n = 1, 'a returning guest must not become a second customer';

  ------------------------------------------------ 7. tracking-only promo --
  insert into public.promo_codes (code, event_id, kind, value, promoter_name)
       values ('WALKTHROUGH', ev_a, 'tracking_only', 0, 'Test Promoter');

  reserved := public.reserve_order(
    ev_a, jsonb_build_array(jsonb_build_object('tier_id', tier_a, 'quantity', 1)),
    'WALKTHROUGH', 12, 'web');
  v_promo_order := (reserved ->> 'order_id')::uuid;
  assert (reserved ->> 'discount_cents')::int = 0, 'a tracking-only code must not discount anything';
  select count(*) into n from public.orders where id = v_promo_order and promo_code_id is not null;
  assert n = 1, 'the order should carry the code it was bought with';

  perform public.fulfill_order(v_promo_order, null, now());
  select redeemed_count into n from public.promo_codes where code = 'WALKTHROUGH';
  assert n = 1, 'a paid order should count against the promoter''s code';

  raise notice 'ticketing walkthrough: all checks passed';
end $$;

------------------------------------------------------------------ 8. RLS --

-- Anonymous callers get nothing. Either the row-level policies return no rows
-- or the grant is absent and Postgres refuses outright; both are a pass, and
-- the block below accepts either rather than pretending only one is correct.
do $$
declare
  visible int;
begin
  set local role anon;

  begin
    select count(*) into visible from public.orders;
    assert visible = 0, format('anonymous callers can see %s orders', visible);
  exception when insufficient_privilege then
    null;
  end;

  begin
    select count(*) into visible from public.tickets;
    assert visible = 0, format('anonymous callers can see %s tickets', visible);
  exception when insufficient_privilege then
    null;
  end;

  begin
    select count(*) into visible from public.customers;
    assert visible = 0, format('anonymous callers can see %s customers', visible);
  exception when insufficient_privilege then
    null;
  end;

  reset role;
  raise notice 'rls: anonymous callers see no orders, tickets or customers';
end $$;

do $$
begin
  execute 'alter table public.event_occurrences enable trigger event_occurrences_guard_publish';
exception when others then
  null;
end $$;

-- Nothing above is kept. The walkthrough proves the rules; it does not leave
-- test orders in a database that also holds real ones.
rollback;
