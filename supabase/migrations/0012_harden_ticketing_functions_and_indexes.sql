-- Post-launch hardening pass over the ticketing schema (0006-0011).
--
-- 1. PIN search_path on every function this build added. None are
--    SECURITY DEFINER, so this is defense-in-depth rather than a live hole,
--    but it clears the linter's WARN and costs nothing: every function body
--    already schema-qualifies `public.` on its own calls.
-- 2. COVERING INDEXES on the ticketing foreign keys that sit on hot paths:
--    a refund looks up ticket_holds by order_id, a scan looks up scans by
--    ticket_id, checkout resolves a promo by id, and check-in updates by
--    tier_id. The other ~25 unindexed-FK findings predate this build (menu,
--    page, event asset references) and are left alone — broader surgery than
--    what shipped here.
-- 3. The one real RLS perf finding: profiles_self_read re-evaluated
--    auth.uid() per row. Wrapped in (select ...) per the documented pattern.
--
-- Deliberately NOT touched:
--   - The 8 "RLS enabled, no policy" tables (orders, tickets, order_items,
--     ticket_holds, scans, processed_stripe_events, rate_limits, email_log).
--     That is the design: no public policy at all, service-role only.
--   - can_administer/can_edit/can_publish/current_role/guard_*/is_owner/
--     handle_new_user/record_audit being SECURITY DEFINER and callable by
--     anon/authenticated. That is how 0001 avoids RLS recursion on
--     `profiles`; changing it risks locking out admin auth and is outside
--     this session's scope.
--   - "Multiple permissive policies" (public read + editor write both
--     matching SELECT) on nine content tables — a pre-existing pattern
--     across the whole content system, cosmetic at this traffic volume.
--   - auth_leaked_password_protection — an Auth dashboard toggle, not a
--     migration (Authentication -> Policies -> Leaked password protection).
--
-- Rollback: the search_path pins are harmless to leave; to revert, `alter
-- function <name> reset search_path` for each. Indexes:
--   drop index if exists ticket_holds_order_idx, tickets_tier_idx,
--     orders_promo_code_idx, scans_ticket_idx;
-- Policy: recreate profiles_self_read with the unwrapped predicate.

alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.sync_menu_item_availability() set search_path = public, pg_temp;
alter function public.tier_seats_taken(uuid) set search_path = public, pg_temp;
alter function public.event_seats_taken(text) set search_path = public, pg_temp;
alter function public.price_order(int, int, text, int, int, int) set search_path = public, pg_temp;
alter function public.reserve_order(text, jsonb, text, int, text) set search_path = public, pg_temp;
alter function public.generate_order_number() set search_path = public, pg_temp;
alter function public.generate_ticket_code() set search_path = public, pg_temp;
alter function public.crockford_random(int) set search_path = public, pg_temp;
alter function public.fulfill_order(uuid, text, timestamptz) set search_path = public, pg_temp;
alter function public.release_expired_holds() set search_path = public, pg_temp;
alter function public.get_event_availability(text) set search_path = public, pg_temp;
alter function public.rate_limit_hit(text, int, int) set search_path = public, pg_temp;

create index if not exists ticket_holds_order_idx on public.ticket_holds (order_id);
create index if not exists tickets_tier_idx on public.tickets (tier_id);
create index if not exists orders_promo_code_idx on public.orders (promo_code_id) where promo_code_id is not null;
create index if not exists scans_ticket_idx on public.scans (ticket_id) where ticket_id is not null;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.can_administer());
