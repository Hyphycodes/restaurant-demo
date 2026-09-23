-- Waitlist for sold-out events.
--
-- One row per guest per event. Written from the public event page through a
-- route handler ("Tell me if tickets open up"), read only by staff. The event
-- key is TEXT because `event_occurrences.id` is text in production
-- (`tickeri:xxxx` for imported rows, a uuid string for manual ones).
--
-- Rollback:
--   drop table if exists public.waitlist;

-- The event key is text everywhere from here on, but 0001 created
-- `event_occurrences.id` as uuid and the conversion was never committed. It is
-- done here, before the first table that references it. A uuid renders to the
-- same canonical string, so existing ids are unchanged; manual rows keep a
-- generated uuid-string default. Idempotent.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'event_occurrences' and column_name = 'id') = 'uuid' then
    alter table public.event_occurrences alter column id drop default;
    alter table public.event_occurrences alter column id type text using id::text;
    alter table public.event_occurrences alter column id set default gen_random_uuid()::text;
  end if;
end $$;

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
