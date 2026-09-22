-- Waitlist for sold-out events.
--
-- One row per guest per event. Written from the public event page through a
-- route handler ("Tell me if tickets open up"), read only by staff. The event
-- key is TEXT because `event_occurrences.id` is text in production
-- (`tickeri:xxxx` for imported rows, a uuid string for manual ones).
--
-- Rollback:
--   drop table if exists public.waitlist;

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.event_occurrences (id) on delete cascade,
  email       text not null check (position('@' in email) > 1),
  created_at  timestamptz not null default now(),
  unique (event_id, email)
);

comment on table public.waitlist is
  'Guests who asked to be told if a sold-out event gets seats back. Public insert only; staff read.';

alter table public.waitlist enable row level security;

drop policy if exists waitlist_public_insert on public.waitlist;
create policy waitlist_public_insert on public.waitlist
  for insert to anon, authenticated with check (true);

drop policy if exists waitlist_staff_read on public.waitlist;
create policy waitlist_staff_read on public.waitlist
  for select to authenticated using (public.can_edit());
-- Deliberately no public select, update or delete.
