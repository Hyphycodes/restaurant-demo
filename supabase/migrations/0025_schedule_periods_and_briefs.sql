-- Casa Aurelia staff operating system, second pass: the schedule week as a thing
-- with a status, the night brief an employee is allowed to read, and a
-- contractor who can see their own booking and nothing else.
--
-- WHY EACH PIECE EXISTS
--
--   schedule_periods — 0022 gave every shift its own draft/published flag,
--     which is right for one shift and wrong for a week. A manager building
--     next week needs to work privately and then release the whole thing at
--     once, and an employee needs to be able to tell the difference between
--     "there is nothing next week" and "next week is not out yet". One row
--     per (location, week) answers that, records who released it and when,
--     and gives the publish notification something to be idempotent against.
--     Shift.status stays: a shift inside a published week can still be
--     drafted, cancelled or added later, and only the affected person hears.
--
--   event_briefs — the operational half of an event. Doors and capacity
--     already live on event_occurrences, but call time, dress, the manager
--     on the night and the "ID checks required" note had nowhere to go, so
--     they were being told to people by text message. Separate table rather
--     than more columns on event_occurrences because that table carries the
--     publish guard and the draft/live editorial split from 0003, and none
--     of that applies to an internal note.
--
--   current_contractor_id() — the mirror of current_employee_id(). A DJ with
--     a sign-in resolves to their own contractors row, reads their own
--     bookings, and every other staff table stays closed to them.
--
-- Rollback: drop the two tables, drop the three contractor policies, drop
-- contractor_bookings.arrival_note, drop the function. Nothing here alters
-- an existing column.

-- ------------------------------------------------- the schedule week -------

create table if not exists public.schedule_periods (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations (id) on delete cascade,
  -- The Monday of the week, as a date in the LOCATION's own zone. A week is
  -- a human unit, not an instant, which is why this is a date and the
  -- boundaries are computed from the location timezone when reading shifts.
  week_start   date not null,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  -- When the "your schedule is live" fan-out went out. A second publish of
  -- the same week (a manager adding one shift on Thursday) must not blast
  -- everyone again, so it checks this first.
  notified_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (location_id, week_start)
);

create index if not exists schedule_periods_week_idx on public.schedule_periods (location_id, week_start desc);

comment on table public.schedule_periods is
  'One week of one location''s schedule, and whether it has been released. No row means the week has never been worked on, which reads the same as draft.';
comment on column public.schedule_periods.notified_at is
  'Set the first time the week is published and never cleared. Re-publishing tells only the people whose shifts changed.';

-- ------------------------------------------------------ the night brief ----

create table if not exists public.event_briefs (
  event_id            text primary key references public.event_occurrences (id) on delete cascade,
  call_time_at        timestamptz,
  dress_code          text,
  expected_guests     integer check (expected_guests is null or expected_guests >= 0),
  manager_employee_id uuid references public.employees (id) on delete set null,
  staff_notes         text,
  updated_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.event_briefs is
  'What the floor needs to know about a night: when to be in, what to wear, who is running it, what to watch for. Readable by every employee; written by managers. Money stays in the ticketing views.';

-- --------------------------------------------- contractors, for themselves --

alter table public.contractor_bookings
  add column if not exists arrival_note text;

comment on column public.contractor_bookings.arrival_note is
  'Shown to the contractor: where to park, which door, who to ask for. Separate from `note`, which is the internal one.';

create or replace function public.current_contractor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.contractors c
   where c.user_id = auth.uid()
     and c.archived_at is null
     and c.active
   limit 1;
$$;

comment on function public.current_contractor_id is
  'The caller''s own contractors row, or null. The contractor equivalent of current_employee_id(); nothing else in the staff system opens up for them. EXECUTE is deliberately NOT revoked: the two policies below call it, and a policy that calls a function the caller may not execute fails for that caller. Supabase''s linter flags it for the same reason it flags current_employee_id() and is_manager() — see migration 0016 for why those five stay. Called as anon, auth.uid() is null and it returns null, so the exposure is a function that tells you nothing.';

-- ------------------------------------------------------------------ RLS -----

alter table public.schedule_periods enable row level security;
alter table public.event_briefs enable row level security;

drop policy if exists schedule_periods_staff_read on public.schedule_periods;
create policy schedule_periods_staff_read on public.schedule_periods for select to authenticated
  using (public.is_manager() or public.is_employee());

drop policy if exists schedule_periods_manager_write on public.schedule_periods;
create policy schedule_periods_manager_write on public.schedule_periods for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists event_briefs_staff_read on public.event_briefs;
create policy event_briefs_staff_read on public.event_briefs for select to authenticated
  using (public.is_manager() or public.is_employee());

drop policy if exists event_briefs_manager_write on public.event_briefs;
create policy event_briefs_manager_write on public.event_briefs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- A contractor reads their own row and their own bookings. The manager-only
-- policies from 0022 stay exactly as they are; these are additional SELECTs,
-- and PostgreSQL ORs permissive policies together.
drop policy if exists contractors_self_read on public.contractors;
create policy contractors_self_read on public.contractors for select to authenticated
  using (id = public.current_contractor_id());

drop policy if exists contractor_bookings_self_read on public.contractor_bookings;
create policy contractor_bookings_self_read on public.contractor_bookings for select to authenticated
  using (contractor_id = public.current_contractor_id());

-- ---------------------------------------------------- touch triggers --------

drop trigger if exists schedule_periods_touch on public.schedule_periods;
create trigger schedule_periods_touch before update on public.schedule_periods
  for each row execute function public.touch_updated_at();

drop trigger if exists event_briefs_touch on public.event_briefs;
create trigger event_briefs_touch before update on public.event_briefs
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- backfill -----

-- Every week that already has a published shift was, in effect, published.
-- Saying so now means an employee looking back at last month does not see
-- "being prepared" over a week they actually worked.
insert into public.schedule_periods (location_id, week_start, status, published_at, notified_at)
select s.location_id,
       (date_trunc('week', (s.starts_at at time zone coalesce(l.timezone, 'America/Chicago')))::date) as week_start,
       'published',
       min(coalesce(s.published_at, s.created_at)),
       min(coalesce(s.published_at, s.created_at))
  from public.shifts s
  join public.locations l on l.id = s.location_id
 where s.status = 'published'
   and s.archived_at is null
 group by s.location_id, 2
on conflict (location_id, week_start) do nothing;
