-- Hiring and local talent: the two inbound people pipelines behind /careers
-- and /talent.
--
-- Three tables, and no more than three. An opening is content the admin
-- publishes; an application and a talent submission are inbound records a
-- stranger creates and only staff can read. Neither of the inbound tables gets
-- a delete policy, for the same reason `inquiries` does not: somebody applied
-- for a job here, and that is a business record.
--
-- What is deliberately NOT here:
--   * a talent_links child table — a submission's links are a short list with
--     no attributes of their own, so they are a text[] on the row;
--   * a second roster of performers — `contractors` (migration 0022) is that
--     roster already. A talent submission points at the contractor it became,
--     so discovery and booking stay one pipeline rather than two.

-- ------------------------------------------------------------- openings ----

create table if not exists public.job_openings (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid references public.locations (id) on delete set null,
  title           text not null check (length(trim(title)) between 1 and 80),
  -- One sentence under the title on the website. Null renders nothing rather
  -- than a made-up description.
  summary         text check (summary is null or length(summary) <= 280),
  employment_type text not null default 'either'
                  check (employment_type in ('full_time', 'part_time', 'either', 'seasonal')),
  -- Only an active opening is public. Everything ships inactive.
  active          boolean not null default false,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

create index if not exists job_openings_active_idx
  on public.job_openings (active, sort) where archived_at is null;

-- --------------------------------------------------------- applications ----

create table if not exists public.job_applications (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  -- The opening, when there was one. `position` is stored alongside it because
  -- an opening can be archived and renamed, and an application has to keep
  -- saying what it was actually for.
  opening_id   uuid references public.job_openings (id) on delete set null,
  position     text not null check (length(trim(position)) between 1 and 120),
  location_id  uuid references public.locations (id) on delete set null,
  name         text not null check (length(trim(name)) between 2 and 120),
  email        text not null check (length(trim(email)) between 3 and 180),
  phone        text,
  availability text,
  experience   text,
  -- Object path inside the private `applications` bucket. Never a public URL.
  resume_path  text,
  resume_name  text,
  notes        text,
  status       text not null default 'new'
               check (status in ('new', 'reviewing', 'contacted', 'interview', 'hired', 'passed', 'archived')),
  staff_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists job_applications_status_idx
  on public.job_applications (status, created_at desc);
create index if not exists job_applications_opening_idx
  on public.job_applications (opening_id, created_at desc);

-- ---------------------------------------------------- talent submissions ----

create table if not exists public.talent_submissions (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  name          text not null check (length(trim(name)) between 2 and 120),
  -- One of the two is required; the check is below, because a person who only
  -- left an Instagram handle and a phone number is still someone worth calling.
  email         text,
  phone         text,
  -- A closed list, so the admin can filter. 'other' is always available and
  -- `pitch` carries what they actually said.
  discipline    text not null default 'other',
  pitch         text not null check (length(trim(pitch)) between 2 and 600),
  links         text[] not null default '{}',
  -- Object paths inside the private `applications` bucket.
  media_paths   text[] not null default '{}',
  idea          text,
  notes         text,
  location_id   uuid references public.locations (id) on delete set null,
  status        text not null default 'new'
                check (status in ('new', 'interested', 'contacted', 'booked', 'featured', 'archived')),
  staff_notes   text,
  -- Set when this person is added to the contractor roster. The bridge between
  -- "we found somebody" and "we book them".
  contractor_id uuid references public.contractors (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint talent_submissions_reachable
    check (coalesce(trim(email), '') <> '' or coalesce(trim(phone), '') <> '')
);

create index if not exists talent_submissions_status_idx
  on public.talent_submissions (status, created_at desc);
create index if not exists talent_submissions_discipline_idx
  on public.talent_submissions (discipline, created_at desc);

-- ------------------------------------------------------------- triggers ----

do $$
declare
  t text;
begin
  foreach t in array array['job_openings', 'job_applications', 'talent_submissions']
  loop
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- An opening is editable content, so it is audited like the menu is. The two
-- inbound tables are not: one row per stranger who filled in a form would
-- double the audit log to record nothing anybody will read.
create trigger job_openings_audit
  after insert or update or delete on public.job_openings
  for each row execute function public.record_audit();

-- ------------------------------------------------------------------ RLS ----

alter table public.job_openings enable row level security;
alter table public.job_applications enable row level security;
alter table public.talent_submissions enable row level security;

-- An opening is public only while it is switched on and not archived.
create policy job_openings_public_read on public.job_openings
  for select to anon, authenticated
  using ((active and archived_at is null) or public.can_edit());
create policy job_openings_staff_write on public.job_openings
  for all to authenticated
  using (public.can_edit()) with check (public.can_edit());

-- Anyone may apply. Only staff may read what was sent, and nobody may delete it.
create policy job_applications_public_insert on public.job_applications
  for insert to anon, authenticated with check (true);
create policy job_applications_staff_read on public.job_applications
  for select to authenticated using (public.can_edit());
create policy job_applications_staff_update on public.job_applications
  for update to authenticated
  using (public.can_edit()) with check (public.can_edit());

create policy talent_submissions_public_insert on public.talent_submissions
  for insert to anon, authenticated with check (true);
create policy talent_submissions_staff_read on public.talent_submissions
  for select to authenticated using (public.can_edit());
create policy talent_submissions_staff_update on public.talent_submissions
  for update to authenticated
  using (public.can_edit()) with check (public.can_edit());

-- -------------------------------------------------------- file storage -----

-- A résumé and a set of photographs are not website media: they belong to the
-- person who sent them. Private bucket, no anonymous read, and the app only
-- ever hands staff a short-lived signed URL.
insert into storage.buckets (id, name, public)
values ('applications', 'applications', false)
on conflict (id) do nothing;

drop policy if exists "applications staff read" on storage.objects;
create policy "applications staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'applications' and public.can_edit());

drop policy if exists "applications manager remove" on storage.objects;
create policy "applications manager remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'applications' and public.can_publish());

-- Uploads arrive through the website's server action using the service role,
-- after it has checked the type and the size. There is deliberately no
-- anonymous insert policy: an open write bucket is a free file host.

-- ------------------------------------------------------- starter openings ---

-- The roles a restaurant of this shape actually runs, every one of them OFF.
-- Nothing is published until somebody at Cosa Nostra switches it on, and no
-- description is invented here — the sentence under the title is theirs to
-- write. Same rows as `REFERENCE_JOB_OPENINGS` in src/content/careers.ts, so
-- the local development database and supabase/seed.sql agree with this.
insert into public.job_openings (id, location_id, title, summary, employment_type, active, sort)
values
  ('c05a0000-0000-4000-8000-000000000101'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Server',      null, 'either',    false, 10),
  ('c05a0000-0000-4000-8000-000000000102'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Bartender',   null, 'either',    false, 20),
  ('c05a0000-0000-4000-8000-000000000103'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Host',        null, 'part_time', false, 30),
  ('c05a0000-0000-4000-8000-000000000104'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Line cook',   null, 'full_time', false, 40),
  ('c05a0000-0000-4000-8000-000000000105'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Prep cook',   null, 'either',    false, 50),
  ('c05a0000-0000-4000-8000-000000000106'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Busser',      null, 'part_time', false, 60),
  ('c05a0000-0000-4000-8000-000000000107'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Dishwasher',  null, 'either',    false, 70),
  ('c05a0000-0000-4000-8000-000000000108'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Door / security', null, 'part_time', false, 80),
  ('c05a0000-0000-4000-8000-000000000109'::uuid, 'c05a0000-0000-4000-8000-000000000001'::uuid, 'Event staff', null, 'part_time', false, 90)
on conflict (id) do nothing;

-- ---------------------------------------------------------- email log ------

-- Three more kinds of email land in the same log as everything else: the
-- applicant's confirmation, the talent confirmation, and the one internal
-- notice that tells Cosa Nostra somebody wrote in.
do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.email_log'::regclass and contype = 'c'
  loop
    if doomed.def ilike '%confirmation%' then
      execute format('alter table public.email_log drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.email_log add constraint email_log_type_known
  check (type in (
    'confirmation', 'reminder', 'tonight', 'resend', 'thanks',
    'refund', 'event_update', 'cancellation',
    'staff_invitation', 'magic_link', 'password_reset', 'verify_email', 'welcome',
    'owner_alert',
    'staff_welcome', 'schedule_published', 'shift_changed', 'time_off_decision',
    'training_required', 'document_expiring', 'event_assignment',
    'application_received', 'talent_received', 'submission_alert'
  ));
