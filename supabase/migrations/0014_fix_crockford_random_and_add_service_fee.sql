-- Fix: crockford_random() calls gen_random_bytes(), which lives in the
-- `extensions` schema on this project (Supabase's default for pgcrypto), not
-- `public`. Migration 0012 pinned every ticketing function's search_path to
-- `public, pg_temp` for security — correct for all of them except this one,
-- which needs `extensions` too or it can never generate an order number or a
-- ticket code. This is what was behind "Could not hold those seats just now"
-- on every real checkout attempt: reserve_order got as far as building the
-- order and then failed calling generate_order_number().
alter function public.crockford_random(integer) set search_path to 'public', 'extensions', 'pg_temp';

-- Add a flat, whole-dollar service fee so the checkout total is an honest,
-- clean number instead of the bare face value ("Nothing added at checkout").
-- No sales tax is set here — tax_rate_bps stays 0 until the owner confirms
-- with their accountant whether these admissions are taxable in Chicago
-- (see docs/runbook.md / the launch checklist); guessing a rate is a real
-- compliance risk this migration deliberately avoids.
--
-- Defaults change too, so a new event created from here on gets the same
-- fee without anyone having to remember to set it by hand.
alter table public.event_occurrences alter column fee_display set default 'itemized';
alter table public.event_occurrences alter column service_fee_flat_cents set default 100;

alter table public.event_occurrences disable trigger event_occurrences_guard_publish;

update public.event_occurrences
set fee_display = 'itemized',
    service_fee_flat_cents = 100
where ticketing_enabled = true;

alter table public.event_occurrences enable trigger event_occurrences_guard_publish;
