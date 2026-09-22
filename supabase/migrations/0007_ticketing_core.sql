-- Ticketing core: tiers, orders, tickets, holds, promo codes, scans, and the
-- functions that make them safe to sell from.
--
-- WHERE EVENTS LIVE. The brief calls the table `events`; in this repository a
-- ticketed event is a standalone `event_occurrences` row (series_slug is null)
-- and its id is TEXT (`tickeri:xxxx` for imported rows). Every reference here
-- is therefore `event_id text references event_occurrences(id)`.
--
-- THE FOUR RULES THIS FILE ENFORCES:
--   1. Money is integer cents. Every amount column is `int`.
--   2. Availability is computed from orders, never stored as a counter.
--   3. Reservation runs inside one transaction with the event row locked, so
--      two buyers cannot both take the last seat.
--   4. Nothing in orders, tickets or holds is readable with the anon key.
--      RLS is on with no public policies; only the service role reads them.
--
-- Rollback (in this order):
--   drop view if exists public.event_attendees, public.event_sales_summary;
--   drop function if exists public.reserve_order(text, jsonb, text, int),
--     public.fulfill_order(uuid, text, timestamptz), public.get_event_availability(text),
--     public.tier_seats_taken(uuid), public.event_seats_taken(text),
--     public.release_expired_holds(), public.generate_ticket_code(),
--     public.generate_order_number(), public.crockford_random(int);
--   drop table if exists public.scans, public.tickets, public.ticket_holds,
--     public.order_items, public.orders, public.promo_codes, public.ticket_tiers,
--     public.processed_stripe_events;
--   alter table public.event_occurrences drop column if exists ticketing_enabled,
--     venue_address, doors_open_at, age_policy, refund_policy, fee_display,
--     tax_rate_bps, service_fee_bps, service_fee_flat_cents, capacity;

-- ------------------------------------------------------------ events ----

alter table public.event_occurrences
  add column if not exists ticketing_enabled      boolean not null default false,
  add column if not exists venue_address          text,
  add column if not exists doors_open_at          timestamptz,
  add column if not exists age_policy             text,
  add column if not exists refund_policy          text,
  add column if not exists fee_display            text not null default 'inclusive',
  add column if not exists tax_rate_bps           int  not null default 0,
  add column if not exists service_fee_bps        int  not null default 0,
  add column if not exists service_fee_flat_cents int  not null default 0,
  -- Event-level seat cap. Null = bounded only by the tiers.
  add column if not exists capacity               int;

alter table public.event_occurrences drop constraint if exists event_occurrences_age_policy_known;
alter table public.event_occurrences add constraint event_occurrences_age_policy_known
  check (age_policy is null or age_policy in ('all_ages', '18+', '21+'));
alter table public.event_occurrences drop constraint if exists event_occurrences_fee_display_known;
alter table public.event_occurrences add constraint event_occurrences_fee_display_known
  check (fee_display in ('inclusive', 'itemized'));
alter table public.event_occurrences drop constraint if exists event_occurrences_rates_sane;
alter table public.event_occurrences add constraint event_occurrences_rates_sane
  check (tax_rate_bps between 0 and 5000 and service_fee_bps between 0 and 5000 and service_fee_flat_cents >= 0);
alter table public.event_occurrences drop constraint if exists event_occurrences_capacity_positive;
alter table public.event_occurrences add constraint event_occurrences_capacity_positive
  check (capacity is null or capacity > 0);

comment on column public.event_occurrences.fee_display is
  'inclusive (default): the tier price is what the guest pays; tax and fees are derived out of it for the books. itemized: fees and tax are added on top and shown as lines.';
comment on column public.event_occurrences.tax_rate_bps is
  'Basis points. Stays 0 until the accountant confirms these admissions are taxable in Chicago. Never hardcode a rate.';

-- ------------------------------------------------------------- tiers ----

create table if not exists public.ticket_tiers (
  id                uuid primary key default gen_random_uuid(),
  event_id          text not null references public.event_occurrences (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  description       text,
  price_cents       int  not null check (price_cents >= 0),
  capacity          int  check (capacity is null or capacity >= 0),
  seats_per_ticket  int  not null default 1 check (seats_per_ticket >= 1),
  min_per_order     int  not null default 0 check (min_per_order >= 0),
  max_per_order     int  not null default 10 check (max_per_order >= 1),
  sales_start_at    timestamptz,
  sales_end_at      timestamptz,
  sort_order        int  not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint ticket_tiers_order_bounds check (min_per_order <= max_per_order),
  constraint ticket_tiers_sales_window check (sales_start_at is null or sales_end_at is null or sales_end_at > sales_start_at)
);
create index if not exists ticket_tiers_event_idx on public.ticket_tiers (event_id, sort_order);

comment on table public.ticket_tiers is
  'What is for sale at an event: Adult, Kid, Table of 4. Prices are integer cents. Capacity null = unlimited (still bounded by the event cap).';

-- ------------------------------------------------------- promo codes ----

create table if not exists public.promo_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null check (length(trim(code)) between 2 and 40),
  event_id         text references public.event_occurrences (id) on delete cascade,
  kind             text not null check (kind in ('percent', 'amount')),
  value            int  not null check (value > 0),
  max_redemptions  int  check (max_redemptions is null or max_redemptions > 0),
  redeemed_count   int  not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint promo_codes_percent_range check (kind <> 'percent' or value between 1 and 100)
);
create unique index if not exists promo_codes_code_event_idx
  on public.promo_codes (upper(code), coalesce(event_id, ''));

-- ------------------------------------------------------------ orders ----

create table if not exists public.orders (
  id                        uuid primary key default gen_random_uuid(),
  order_number              text not null unique,
  event_id                  text not null references public.event_occurrences (id),
  status                    text not null default 'pending'
                            check (status in ('pending','paid','failed','canceled','refunded','partially_refunded','disputed')),
  customer_name             text,
  customer_email            text,
  customer_phone            text,
  subtotal_cents            int not null default 0 check (subtotal_cents >= 0),
  service_fee_cents         int not null default 0 check (service_fee_cents >= 0),
  tax_cents                 int not null default 0 check (tax_cents >= 0),
  discount_cents            int not null default 0 check (discount_cents >= 0),
  total_cents               int not null default 0 check (total_cents >= 0),
  refunded_cents            int not null default 0 check (refunded_cents >= 0),
  currency                  text not null default 'usd',
  source                    text not null default 'web' check (source in ('web','door','comp','import')),
  promo_code_id             uuid references public.promo_codes (id),
  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  consent_text              text,
  consent_at                timestamptz,
  expires_at                timestamptz,
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  notes                     text,
  -- The row always balances, in both fee modes.
  constraint orders_balance check (total_cents = subtotal_cents + service_fee_cents + tax_cents - discount_cents)
);
create index if not exists orders_event_status_idx on public.orders (event_id, status);
create index if not exists orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending';
create index if not exists orders_email_idx on public.orders (lower(customer_email));

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  tier_id          uuid not null references public.ticket_tiers (id),
  tier_name        text not null,
  unit_price_cents int  not null check (unit_price_cents >= 0),
  quantity         int  not null check (quantity > 0),
  seats            int  not null check (seats > 0),
  subtotal_cents   int  not null check (subtotal_cents >= 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_tier_idx on public.order_items (tier_id);

comment on column public.order_items.tier_name is 'Snapshot at time of order. Tiers get renamed; receipts do not.';

-- ----------------------------------------------------------- tickets ----

create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  order_item_id   uuid not null references public.order_items (id) on delete cascade,
  event_id        text not null references public.event_occurrences (id),
  tier_id         uuid not null references public.ticket_tiers (id),
  -- Position within its order item. The unique pair is what makes minting
  -- idempotent: a replayed webhook cannot insert a second ticket #1.
  seq             int  not null,
  code            text not null unique,
  status          text not null default 'valid' check (status in ('valid','checked_in','void','refunded')),
  attendee_name   text,
  seats           int  not null default 1 check (seats >= 1),
  checked_in_at   timestamptz,
  checked_in_by   text,
  created_at      timestamptz not null default now(),
  unique (order_item_id, seq)
);
create index if not exists tickets_event_status_idx on public.tickets (event_id, status);
create index if not exists tickets_order_idx on public.tickets (order_id);

-- ------------------------------------------------------------- holds ----

create table if not exists public.ticket_holds (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  tier_id     uuid not null references public.ticket_tiers (id),
  seats       int  not null check (seats > 0),
  expires_at  timestamptz not null,
  released_at timestamptz
);
create index if not exists ticket_holds_live_idx on public.ticket_holds (tier_id) where released_at is null;

comment on table public.ticket_holds is
  'A record of the seats a pending order is holding. Availability is computed from orders, not from here; this exists so the hold can be inspected and released explicitly.';

-- ------------------------------------------------------------- scans ----

create table if not exists public.scans (
  id            bigserial primary key,
  ticket_id     uuid references public.tickets (id) on delete set null,
  event_id      text references public.event_occurrences (id) on delete set null,
  raw_code      text,
  result        text not null check (result in ('ok','duplicate','invalid','wrong_event','void','override')),
  device_label  text,
  scanned_by    text,
  scanned_at    timestamptz not null default now()
);
create index if not exists scans_event_idx on public.scans (event_id, scanned_at desc);

-- --------------------------------------------------- stripe idempotency ----

create table if not exists public.processed_stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);
comment on table public.processed_stripe_events is
  'Every Stripe event id we have handled. The primary key IS the idempotency guard: a replayed webhook fails the insert and returns 200 immediately.';

-- ------------------------------------------------------------ codes ----

-- Crockford base32 with no I, L, O or U: unambiguous when read aloud at a door.
create or replace function public.crockford_random(p_length int)
returns text language plpgsql volatile as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := gen_random_bytes(p_length);
  out text := '';
  i int;
begin
  for i in 0 .. p_length - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

create or replace function public.generate_order_number()
returns text language plpgsql volatile as $$
declare
  candidate text;
begin
  loop
    candidate := 'CNS-' || public.crockford_random(5);
    exit when not exists (select 1 from public.orders where order_number = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.generate_ticket_code()
returns text language plpgsql volatile as $$
declare
  raw text;
  candidate text;
begin
  loop
    raw := public.crockford_random(8);
    candidate := substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
    exit when not exists (select 1 from public.tickets where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ------------------------------------------------------- availability ----

-- Seats a tier has committed: paid orders, plus pending orders whose hold has
-- not expired. An expired pending order stops counting the moment it expires,
-- whether or not the cleanup has run — cleanup is hygiene, not correctness.
create or replace function public.tier_seats_taken(p_tier_id uuid)
returns int language sql stable as $$
  select coalesce((
    select sum(oi.seats)::int
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.tier_id = p_tier_id
       and (o.status in ('paid', 'partially_refunded', 'disputed')
            or (o.status = 'pending' and o.expires_at > now()))
  ), 0);
$$;

create or replace function public.event_seats_taken(p_event_id text)
returns int language sql stable as $$
  select coalesce((
    select sum(oi.seats)::int
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.event_id = p_event_id
       and (o.status in ('paid', 'partially_refunded', 'disputed')
            or (o.status = 'pending' and o.expires_at > now()))
  ), 0);
$$;

-- THE ONE AVAILABILITY READ. The public page, the admin, the reservation and
-- the door all call this; nothing else counts seats.
create or replace function public.get_event_availability(p_event_id text)
returns jsonb language plpgsql stable as $$
declare
  ev record;
  event_taken int;
  event_available int;
  tiers jsonb;
begin
  select id, capacity, ticketing_enabled, published, archived_at, ends_at
    into ev
    from public.event_occurrences where id = p_event_id;
  if not found then
    return null;
  end if;

  event_taken := public.event_seats_taken(p_event_id);
  event_available := case when ev.capacity is null then null else greatest(ev.capacity - event_taken, 0) end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'tier_id', t.id,
    'name', t.name,
    'description', t.description,
    'price_cents', t.price_cents,
    'seats_per_ticket', t.seats_per_ticket,
    'min_per_order', t.min_per_order,
    'max_per_order', t.max_per_order,
    'capacity', t.capacity,
    'taken', taken.n,
    -- Bounded by the tier's own cap AND whatever the event has left.
    'available', case
      when t.capacity is null and event_available is null then null
      when t.capacity is null then event_available
      when event_available is null then greatest(t.capacity - taken.n, 0)
      else least(greatest(t.capacity - taken.n, 0), event_available)
    end,
    'on_sale', t.is_active
      and (t.sales_start_at is null or t.sales_start_at <= now())
      and (t.sales_end_at is null or t.sales_end_at > now()),
    'sort_order', t.sort_order
  ) order by t.sort_order, t.created_at), '[]'::jsonb)
    into tiers
    from public.ticket_tiers t
    cross join lateral (select public.tier_seats_taken(t.id) as n) taken
   where t.event_id = p_event_id;

  return jsonb_build_object(
    'event_id', ev.id,
    'ticketing_enabled', ev.ticketing_enabled,
    'capacity', ev.capacity,
    'taken', event_taken,
    'available', event_available,
    'tiers', tiers
  );
end;
$$;

-- ------------------------------------------------------------- holds ----

-- Expired pending orders become canceled and their holds are released.
create or replace function public.release_expired_holds()
returns int language plpgsql volatile as $$
declare
  n int;
begin
  with expired as (
    update public.orders
       set status = 'canceled'
     where status = 'pending' and expires_at is not null and expires_at <= now()
    returning id
  )
  update public.ticket_holds h
     set released_at = now()
    from expired e
   where h.order_id = e.id and h.released_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ----------------------------------------------------------- pricing ----

-- The pricing engine. Implemented here, mirrored in src/lib/pricing.ts for
-- optimistic display. If they ever disagree, this wins.
--
--   face      = Σ price × qty
--   discount  = promo ? (percent: round(face × v/100) | amount: min(v, face)) : 0
--   net       = face − discount
--   itemized  : service = round(net × fee_bps/10000) + flat
--               tax     = round((net + service) × tax_bps/10000)
--               total   = net + service + tax ; subtotal = face
--   inclusive : total   = net
--               tax     = round(total × tax_bps / (10000 + tax_bps))
--               service = round((total − tax) × fee_bps/10000) + flat
--               subtotal = face − tax − service   (so the row balances)
create or replace function public.price_order(
  p_face_cents int,
  p_discount_cents int,
  p_fee_display text,
  p_tax_rate_bps int,
  p_service_fee_bps int,
  p_service_fee_flat_cents int
) returns jsonb language plpgsql immutable as $$
declare
  net int := p_face_cents - p_discount_cents;
  service int;
  tax int;
  total int;
  subtotal int;
begin
  if p_fee_display = 'itemized' then
    service := round(net::numeric * p_service_fee_bps / 10000)::int + p_service_fee_flat_cents;
    tax := round((net + service)::numeric * p_tax_rate_bps / 10000)::int;
    total := net + service + tax;
    subtotal := p_face_cents;
  else
    total := net;
    tax := round(total::numeric * p_tax_rate_bps / (10000 + p_tax_rate_bps))::int;
    service := round((total - tax)::numeric * p_service_fee_bps / 10000)::int + p_service_fee_flat_cents;
    subtotal := p_face_cents - tax - service;
  end if;
  return jsonb_build_object(
    'subtotal_cents', subtotal,
    'service_fee_cents', service,
    'tax_cents', tax,
    'discount_cents', p_discount_cents,
    'total_cents', total
  );
end;
$$;

-- ----------------------------------------------------------- reserve ----

-- Reserve seats for a would-be order, in one transaction, with the event row
-- locked. Raises with a distinct message the API maps to something friendly:
--   EVENT_NOT_FOUND · EVENT_NOT_ON_SALE · EVENT_PAST · NO_ITEMS · TIER_NOT_FOUND
--   TIER_CLOSED · MIN_PER_ORDER · MAX_PER_ORDER · TIER_SOLD_OUT · EVENT_SOLD_OUT
--   PROMO_INVALID
-- `detail` carries the tier id (or code) the error is about.
create or replace function public.reserve_order(
  p_event_id text,
  p_items jsonb,
  p_promo_code text default null,
  p_hold_minutes int default 12,
  p_source text default 'web'
) returns jsonb language plpgsql volatile as $$
declare
  ev record;
  item jsonb;
  tier record;
  qty int;
  seats int;
  taken int;
  face int := 0;
  discount int := 0;
  promo record;
  promo_id uuid := null;
  promo_kind text := null;
  promo_value int := 0;
  priced jsonb;
  new_order_id uuid := gen_random_uuid();
  order_no text;
  expires timestamptz := now() + make_interval(mins => greatest(p_hold_minutes, 1));
  items_out jsonb := '[]'::jsonb;
  event_cap_left int;
  requested_event_seats int := 0;
begin
  perform public.release_expired_holds();

  -- Serialises every buyer of this event. At this scale one lock is simpler
  -- to reason about than per-tier locking, and it is enough.
  select * into ev from public.event_occurrences where id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not ev.ticketing_enabled or not ev.published or ev.archived_at is not null
     or ev.series_slug is not null or ev.status in ('cancelled', 'postponed') then
    if p_source = 'web' then
      raise exception 'EVENT_NOT_ON_SALE' using errcode = 'P0001';
    end if;
  end if;
  if ev.ends_at <= now() then
    raise exception 'EVENT_PAST' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;

  -- Promo, if any. Scoped to this event or global, active, inside its window,
  -- with redemptions left.
  if p_promo_code is not null and length(trim(p_promo_code)) > 0 then
    select * into promo from public.promo_codes
     where upper(code) = upper(trim(p_promo_code))
       and (event_id = p_event_id or event_id is null)
       and is_active
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at > now())
       and (max_redemptions is null or redeemed_count < max_redemptions)
     order by event_id nulls last
     limit 1;
    if not found then
      raise exception 'PROMO_INVALID' using errcode = 'P0001', detail = p_promo_code;
    end if;
    promo_id := promo.id;
    promo_kind := promo.kind;
    promo_value := promo.value;
  end if;

  event_cap_left := case when ev.capacity is null then null
                         else ev.capacity - public.event_seats_taken(p_event_id) end;

  -- Validate every line before writing anything.
  for item in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((item ->> 'quantity')::int, 0);
    if qty <= 0 then
      continue;
    end if;
    select * into tier from public.ticket_tiers
     where id = (item ->> 'tier_id')::uuid and event_id = p_event_id;
    if not found then
      raise exception 'TIER_NOT_FOUND' using errcode = 'P0001', detail = item ->> 'tier_id';
    end if;
    if p_source = 'web' and (not tier.is_active
       or (tier.sales_start_at is not null and tier.sales_start_at > now())
       or (tier.sales_end_at is not null and tier.sales_end_at <= now())) then
      raise exception 'TIER_CLOSED' using errcode = 'P0001', detail = tier.id::text;
    end if;
    if p_source = 'web' and qty < tier.min_per_order then
      raise exception 'MIN_PER_ORDER' using errcode = 'P0001', detail = tier.id::text;
    end if;
    if p_source = 'web' and qty > tier.max_per_order then
      raise exception 'MAX_PER_ORDER' using errcode = 'P0001', detail = tier.id::text;
    end if;
    seats := qty * tier.seats_per_ticket;
    taken := public.tier_seats_taken(tier.id);
    if tier.capacity is not null and taken + seats > tier.capacity then
      raise exception 'TIER_SOLD_OUT' using errcode = 'P0001', detail = tier.id::text;
    end if;
    requested_event_seats := requested_event_seats + seats;
    face := face + qty * tier.price_cents;
  end loop;

  if requested_event_seats = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;
  if event_cap_left is not null and requested_event_seats > event_cap_left then
    raise exception 'EVENT_SOLD_OUT' using errcode = 'P0001';
  end if;

  if promo_id is not null then
    discount := case when promo_kind = 'percent'
                     then round(face::numeric * promo_value / 100)::int
                     else least(promo_value, face) end;
  end if;

  priced := public.price_order(face, discount, ev.fee_display, ev.tax_rate_bps,
                               ev.service_fee_bps, ev.service_fee_flat_cents);

  order_no := public.generate_order_number();
  insert into public.orders (id, order_number, event_id, status, subtotal_cents, service_fee_cents,
                             tax_cents, discount_cents, total_cents, source, promo_code_id, expires_at)
  values (new_order_id, order_no, p_event_id, 'pending',
          (priced ->> 'subtotal_cents')::int, (priced ->> 'service_fee_cents')::int,
          (priced ->> 'tax_cents')::int, (priced ->> 'discount_cents')::int,
          (priced ->> 'total_cents')::int, p_source, promo_id, expires);

  for item in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((item ->> 'quantity')::int, 0);
    if qty <= 0 then continue; end if;
    select * into tier from public.ticket_tiers where id = (item ->> 'tier_id')::uuid;
    seats := qty * tier.seats_per_ticket;
    insert into public.order_items (order_id, tier_id, tier_name, unit_price_cents, quantity, seats, subtotal_cents)
    values (new_order_id, tier.id, tier.name, tier.price_cents, qty, seats, qty * tier.price_cents);
    insert into public.ticket_holds (order_id, tier_id, seats, expires_at)
    values (new_order_id, tier.id, seats, expires);
    items_out := items_out || jsonb_build_object(
      'tier_id', tier.id, 'tier_name', tier.name, 'unit_price_cents', tier.price_cents,
      'quantity', qty, 'seats', seats, 'subtotal_cents', qty * tier.price_cents);
  end loop;

  return jsonb_build_object(
    'order_id', new_order_id,
    'order_number', order_no,
    'event_id', p_event_id,
    'expires_at', expires,
    'face_cents', face,
    'items', items_out
  ) || priced;
end;
$$;

-- ----------------------------------------------------------- fulfill ----

-- Mark an order paid and mint its tickets, exactly once. Safe to call twice:
-- the (order_item_id, seq) unique pair refuses a second ticket #1, and an
-- order already paid returns its existing tickets without touching anything.
create or replace function public.fulfill_order(
  p_order_id uuid,
  p_charge_id text default null,
  p_paid_at timestamptz default now()
) returns jsonb language plpgsql volatile as $$
declare
  o record;
  oi record;
  i int;
  minted int := 0;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if o.status not in ('paid', 'partially_refunded', 'disputed', 'refunded') then
    update public.orders
       set status = 'paid',
           paid_at = coalesce(paid_at, p_paid_at),
           stripe_charge_id = coalesce(p_charge_id, stripe_charge_id)
     where id = p_order_id;
    if o.promo_code_id is not null then
      update public.promo_codes set redeemed_count = redeemed_count + 1 where id = o.promo_code_id;
    end if;
  elsif p_charge_id is not null and o.stripe_charge_id is null then
    update public.orders set stripe_charge_id = p_charge_id where id = p_order_id;
  end if;

  update public.ticket_holds set released_at = now() where order_id = p_order_id and released_at is null;

  for oi in select * from public.order_items where order_id = p_order_id loop
    for i in 1 .. oi.quantity loop
      insert into public.tickets (order_id, order_item_id, event_id, tier_id, seq, code, seats)
      values (p_order_id, oi.id, o.event_id, oi.tier_id, i, public.generate_ticket_code(),
              greatest(oi.seats / oi.quantity, 1))
      on conflict (order_item_id, seq) do nothing;
      if found then minted := minted + 1; end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'minted', minted,
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'tier_id', t.tier_id, 'seats', t.seats, 'status', t.status) order by t.created_at, t.seq), '[]'::jsonb)
                  from public.tickets t where t.order_id = p_order_id)
  );
end;
$$;

-- --------------------------------------------------------------- RLS ----

alter table public.ticket_tiers             enable row level security;
alter table public.promo_codes              enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;
alter table public.tickets                  enable row level security;
alter table public.ticket_holds             enable row level security;
alter table public.scans                    enable row level security;
alter table public.processed_stripe_events  enable row level security;

-- Tiers of a published, live event are public. Everything else has NO public
-- policy at all: every read and write goes through server code with the
-- service role, which is the whole point.
drop policy if exists ticket_tiers_public_read on public.ticket_tiers;
create policy ticket_tiers_public_read on public.ticket_tiers
  for select to anon, authenticated
  using (
    is_active and exists (
      select 1 from public.event_occurrences e
       where e.id = ticket_tiers.event_id and e.published and e.archived_at is null
    )
  );

drop policy if exists ticket_tiers_manager_write on public.ticket_tiers;
create policy ticket_tiers_manager_write on public.ticket_tiers
  for all to authenticated using (public.can_publish()) with check (public.can_publish());

drop policy if exists promo_codes_manager_all on public.promo_codes;
create policy promo_codes_manager_all on public.promo_codes
  for all to authenticated using (public.can_publish()) with check (public.can_publish());

-- The money functions are never callable with a public key.
revoke execute on function public.reserve_order(text, jsonb, text, int, text) from public, anon, authenticated;
revoke execute on function public.fulfill_order(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.release_expired_holds() from public, anon, authenticated;
revoke execute on function public.generate_order_number() from public, anon, authenticated;
revoke execute on function public.generate_ticket_code() from public, anon, authenticated;
revoke execute on function public.crockford_random(int) from public, anon, authenticated;
grant execute on function public.reserve_order(text, jsonb, text, int, text) to service_role;
grant execute on function public.fulfill_order(uuid, text, timestamptz) to service_role;
grant execute on function public.release_expired_holds() to service_role;
grant execute on function public.get_event_availability(text) to service_role, anon, authenticated;

-- ------------------------------------------------------------- views ----

-- Per event: what sold, what it grossed, what came back.
create or replace view public.event_sales_summary
with (security_invoker = true) as
select
  e.id as event_id,
  e.title,
  e.starts_at,
  e.capacity,
  e.ticketing_enabled,
  (select count(*) from public.tickets t where t.event_id = e.id and t.status <> 'void')::int as tickets_sold,
  public.event_seats_taken(e.id) as seats_taken,
  (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'checked_in')::int as checked_in,
  coalesce((select sum(o.total_cents) from public.orders o where o.event_id = e.id and o.status in ('paid','partially_refunded','refunded','disputed')), 0)::int as gross_cents,
  coalesce((select sum(o.refunded_cents) from public.orders o where o.event_id = e.id), 0)::int as refunded_cents,
  (coalesce((select sum(o.total_cents) from public.orders o where o.event_id = e.id and o.status in ('paid','partially_refunded','refunded','disputed')), 0)
   - coalesce((select sum(o.refunded_cents) from public.orders o where o.event_id = e.id), 0))::int as net_cents,
  coalesce((select sum(o.total_cents) from public.orders o where o.event_id = e.id and o.source = 'web' and o.status in ('paid','partially_refunded','disputed')), 0)::int as web_cents,
  coalesce((select sum(o.total_cents) from public.orders o where o.event_id = e.id and o.source = 'door' and o.status in ('paid','partially_refunded','disputed')), 0)::int as door_cents,
  (select count(*) from public.orders o where o.event_id = e.id and o.status in ('paid','partially_refunded','refunded','disputed'))::int as orders_count,
  (select count(*) from public.orders o where o.event_id = e.id and o.source = 'comp' and o.status = 'paid')::int as comp_orders,
  (select max(o.paid_at) from public.orders o where o.event_id = e.id and o.status in ('paid','partially_refunded','refunded','disputed')) as last_sale_at
from public.event_occurrences e
where e.series_slug is null;

-- Per event: the door list. One row per ticket.
create or replace view public.event_attendees
with (security_invoker = true) as
select
  t.event_id,
  t.id as ticket_id,
  t.code,
  t.status as ticket_status,
  t.seats,
  t.checked_in_at,
  t.checked_in_by,
  coalesce(t.attendee_name, o.customer_name) as attendee_name,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  oi.tier_name,
  oi.quantity,
  o.order_number,
  o.status as order_status,
  o.source,
  o.total_cents,
  o.paid_at
from public.tickets t
join public.orders o on o.id = t.order_id
join public.order_items oi on oi.id = t.order_item_id;

-- Views are read by server code with the service role; nothing public.
revoke all on public.event_sales_summary from anon;
revoke all on public.event_attendees from anon;
