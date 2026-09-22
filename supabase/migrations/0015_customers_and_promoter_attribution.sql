-- Customers, promoter attribution, and the two scan results that were missing.
--
-- Phase 01 of the ticketing brief asks for three things this schema did not
-- have. None of them changes how a ticket is sold; all of them are additive.
--
--   1. CUSTOMERS. Until now a buyer existed only as three columns on an order,
--      so "everyone who has ever bought" was a group-by and "may we email her"
--      had no answer at all. The customer list is the asset Tickeri currently
--      owns; this is where it starts being ours. Keyed by lowercased email,
--      linked from orders, and NEVER deleted on a refund.
--
--   2. PROMOTER ATTRIBUTION. `promo_codes` gains `promoter_name` and a third
--      kind, `tracking_only` — a code that discounts nothing and exists purely
--      so the takings can be split by who brought the room. Because a
--      tracking-only code carries value 0, the existing discount rule in
--      reserve_order (`least(value, face)`) already yields 0: no money
--      function is touched by this migration.
--
--   3. SCAN RESULTS. A refunded ticket used to scan as `void` and an unknown
--      code as `invalid`. Both now have their own result, because "this ticket
--      was refunded" and "this is not one of ours" are different conversations
--      at a door.
--
-- Rollback:
--   drop trigger if exists orders_link_customer on public.orders;
--   drop function if exists public.link_order_customer();
--   drop function if exists public.upsert_customer(text, text, text);
--   alter table public.orders drop column if exists customer_id;
--   drop table if exists public.customers;
--   alter table public.promo_codes drop column if exists promoter_name;
--   (the two check constraints revert to their 0007 definitions)

-- --------------------------------------------------------- customers ----

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  -- Stored lowercased so the address is the identity. The check is what stops
  -- Maria@ and maria@ becoming two people six months from now.
  email             text not null unique check (email = lower(email) and position('@' in email) > 1),
  name              text,
  phone             text,
  -- Consent, and when it was given. Both matter if anyone ever texts or mails
  -- this list; neither is ever set by a checkbox that defaults to ticked.
  marketing_opt_in  boolean not null default false,
  opted_in_at       timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  notes             text,
  created_at        timestamptz not null default now()
);

comment on table public.customers is
  'Everyone who has bought a ticket, keyed by lowercased email and persisting across events. Lifetime tickets and spend are computed from orders, never stored here — a stored counter and the orders disagree eventually.';
comment on column public.customers.marketing_opt_in is
  'False until the guest says otherwise. Marketing to this list without it is not ours to do.';
comment on column public.customers.first_seen_at is
  'Their first paid order. A refund never removes a customer, so this survives one.';

create index if not exists customers_last_seen_idx on public.customers (last_seen_at desc);

alter table public.orders add column if not exists customer_id uuid references public.customers (id);
create index if not exists orders_customer_idx on public.orders (customer_id);
comment on column public.orders.customer_id is
  'Set when the order is paid. The name, email and phone stay on the order as well: the order is the receipt and must not change when the customer later corrects their name.';

-- Find or make the customer behind an email, and note that they were seen.
-- Name and phone only ever overwrite when the new value is non-empty, so a
-- door sale with no name cannot blank out what an earlier order knew.
create or replace function public.upsert_customer(
  p_email text,
  p_name  text default null,
  p_phone text default null,
  p_seen  timestamptz default now()
) returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  found_id uuid;
begin
  if normalized = '' or position('@' in normalized) < 2 then
    return null;
  end if;

  insert into public.customers (email, name, phone, first_seen_at, last_seen_at)
       values (normalized, nullif(trim(coalesce(p_name, '')), ''), nullif(trim(coalesce(p_phone, '')), ''), p_seen, p_seen)
  on conflict (email) do update
          set name          = coalesce(nullif(trim(coalesce(excluded.name, '')), ''), public.customers.name),
              phone         = coalesce(nullif(trim(coalesce(excluded.phone, '')), ''), public.customers.phone),
              first_seen_at = least(public.customers.first_seen_at, excluded.first_seen_at),
              last_seen_at  = greatest(public.customers.last_seen_at, excluded.last_seen_at)
    returning id into found_id;

  return found_id;
end;
$$;

-- An order becomes a customer the moment it is paid — whether that came from
-- the Stripe webhook, a free order, a door sale or a comp. A BEFORE trigger,
-- so the link is written in the same row update and cannot recurse.
create or replace function public.link_order_customer()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status = 'paid'
     and new.customer_id is null
     and coalesce(new.customer_email, '') <> ''
     and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    new.customer_id := public.upsert_customer(
      new.customer_email,
      new.customer_name,
      new.customer_phone,
      coalesce(new.paid_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_link_customer on public.orders;
create trigger orders_link_customer
  before insert or update of status on public.orders
  for each row execute function public.link_order_customer();

-- Every order already paid for, back to the first one. Idempotent: the upsert
-- matches on email and the update only fills a null link.
do $$
declare
  row_order record;
  linked uuid;
begin
  for row_order in
    select id, customer_email, customer_name, customer_phone, coalesce(paid_at, created_at) as seen
      from public.orders
     where customer_id is null
       and coalesce(customer_email, '') <> ''
       and status in ('paid', 'partially_refunded', 'refunded', 'disputed')
     order by coalesce(paid_at, created_at)
  loop
    linked := public.upsert_customer(row_order.customer_email, row_order.customer_name, row_order.customer_phone, row_order.seen);
    if linked is not null then
      update public.orders set customer_id = linked where id = row_order.id;
    end if;
  end loop;
end $$;

-- Service role only, exactly like orders and tickets. No policy is the policy.
alter table public.customers enable row level security;
revoke all on public.customers from anon, authenticated;
revoke execute on function public.upsert_customer(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_customer(text, text, text, timestamptz) to service_role;

-- ------------------------------------------------- promoter attribution ----

alter table public.promo_codes add column if not exists promoter_name text;
comment on column public.promo_codes.promoter_name is
  'Who this code belongs to. With redeemed_count and the orders that carry the code, that is a payout report.';

-- A third kind, worth nothing off the price. `value` must be 0 for it, which is
-- what makes the existing `least(value, face)` discount rule return 0 without
-- reserve_order being rewritten.
--
-- The old constraints came from inline column checks, so their names are
-- Postgres's to choose. Dropping them by their DEFINITION rather than by a
-- guessed name is what stops this migration from "succeeding" while the old,
-- narrower check quietly stays behind and rejects every tracking-only code.
do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.promo_codes'::regclass and contype = 'c'
  loop
    -- The kind check: names both existing kinds. (The percent-range check
    -- mentions 'percent' but never 'amount', so it is left alone.)
    if doomed.def ilike '%''percent''%' and doomed.def ilike '%''amount''%' and doomed.def not ilike '%tracking_only%' then
      execute format('alter table public.promo_codes drop constraint %I', doomed.conname);
    -- The value check: a bare positive test, with no mention of kind.
    elsif doomed.def ilike '%value > 0%' and doomed.def not ilike '%kind%' then
      execute format('alter table public.promo_codes drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.promo_codes drop constraint if exists promo_codes_kind_known;
alter table public.promo_codes add constraint promo_codes_kind_known
  check (kind in ('percent', 'amount', 'tracking_only'));

alter table public.promo_codes drop constraint if exists promo_codes_value_sane;
alter table public.promo_codes add constraint promo_codes_value_sane
  check ((kind = 'tracking_only' and value = 0) or (kind <> 'tracking_only' and value > 0));

-- ------------------------------------------------------- scan results ----

-- `duplicate` and `invalid` keep their meanings; `refunded` and `not_found`
-- split off the two cases that were being told the wrong story at the door.
-- Dropped by definition, for the same reason as above.
do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.scans'::regclass and contype = 'c'
  loop
    if doomed.def ilike '%wrong_event%' and doomed.def not ilike '%not_found%' then
      execute format('alter table public.scans drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.scans drop constraint if exists scans_result_known;
alter table public.scans add constraint scans_result_known
  check (result in ('ok', 'duplicate', 'invalid', 'wrong_event', 'void', 'refunded', 'not_found', 'override'));

comment on table public.scans is
  'Every scan attempt, including the ones that failed. A code that matched nothing still writes a row with ticket_id null — that is how "someone was passing screenshots around at 8:47" stops being a suspicion and becomes a record.';
