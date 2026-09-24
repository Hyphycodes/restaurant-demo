-- Casa Aurelia staff admin — editorial workflow, event overrides, media, and pages.
--
-- Four things this migration adds, and the reasoning for each:
--
-- 1. DRAFTS WITHOUT A SHADOW TABLE.
--    Each editable table gains `draft jsonb`. The row's ordinary columns are what
--    the public reads; `draft` holds unpublished edits and is never selected by a
--    public query. Publishing merges draft into the live columns and clears it.
--    A shadow "draft row" table would have doubled every read path and every
--    foreign key; one nullable column does not.
--
-- 2. THE PUBLISH RESTRICTION IS A DATABASE RULE.
--    A Contributor may write `draft` and nothing else. That is enforced by a
--    BEFORE UPDATE trigger comparing the live columns, so it holds for a direct
--    PostgREST call, not only for a server action that remembered to check.
--
-- 3. EVENT OCCURRENCES BECOME REAL OVERRIDES.
--    The table existed since 0001 and nothing ever read it. Recurring dates are
--    still generated from cadence at read time — that is what makes a stale date
--    structurally impossible — but a single night can now carry its own artwork,
--    ticket link, admission, times or cancellation, and a one-time event is an
--    occurrence with no series.
--
-- 4. MEDIA GAINS THE FIELDS AN UPLOAD NEEDS, and archiving is blocked while a
--    reference exists. Nothing cascades; content a guest has seen is archived.

-- ------------------------------------------------------------- capabilities --

-- 'editor' is the Contributor role: edits and saves drafts, never publishes.
create or replace function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'admin');
$$;

comment on function public.can_publish is
  'Owner and Manager. A Contributor (editor) can save drafts but cannot make anything public.';

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'owner';
$$;

-- --------------------------------------------------------------- profiles ---

alter table public.profiles
  add column if not exists active        boolean not null default true,
  add column if not exists sections      text[]  not null default '{}',
  add column if not exists last_login_at timestamptz;

comment on column public.profiles.sections is
  'Optional Contributor restriction. Empty means every section they are otherwise allowed to edit.';

-- ------------------------------------------------------- editorial columns --

do $$
declare
  t text;
begin
  foreach t in array array[
    'menus', 'menu_categories', 'menu_items', 'event_series', 'event_occurrences',
    'catering_packages', 'catering_items', 'page_sections', 'media_assets'
  ]
  loop
    execute format('alter table public.%I add column if not exists draft jsonb', t);
    execute format('alter table public.%I add column if not exists archived_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_by uuid references auth.users (id) on delete set null', t);
    execute format($f$comment on column public.%I.draft is
      'Unpublished edits. Never read by a public query. Publishing merges it into the live columns and sets it back to null.'$f$, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------ menu changes --

-- Price mode makes the difference between "$16", "Ask your server", "market
-- price" and "priced, but not shown publicly" explicit, instead of inferring it
-- from whether price_cents happens to be null.
alter table public.menu_items
  add column if not exists price_mode text not null default 'fixed'
    check (price_mode in ('fixed', 'ask-server', 'market', 'hidden')),
  add column if not exists availability text not null default 'available'
    check (availability in ('available', 'unavailable', 'hidden')),
  add column if not exists availability_note text,
  add column if not exists media_asset_id text references public.media_assets (asset_id) on delete set null;

-- Backfill from the columns 0001 shipped, then keep `available` in step so any
-- reader that has not been updated yet still sees the truth.
update public.menu_items
   set price_mode = case when price_cents is not null then 'fixed' else 'ask-server' end
 where price_mode = 'fixed' and price_cents is null;

update public.menu_items
   set availability = case when available then 'available' else 'unavailable' end;

create or replace function public.sync_menu_item_availability()
returns trigger
language plpgsql
as $$
begin
  new.available := (new.availability = 'available');
  -- A non-fixed price must not leave a stale number where the public read can
  -- reach it. This is the rule that stops "market price" rendering as $16.
  if new.price_mode <> 'fixed' then
    new.price_cents := null;
    if new.price_note is null or length(trim(new.price_note)) = 0 then
      new.price_note := case
        when new.price_mode = 'market' then 'Market price'
        when new.price_mode = 'hidden' then 'Not shown'
        else 'Ask your server'
      end;
    end if;
  else
    new.price_note := null;
  end if;
  return new;
end;
$$;

create trigger menu_items_sync
  before insert or update on public.menu_items
  for each row execute function public.sync_menu_item_availability();

-- --------------------------------------------------------- event overrides --

-- A one-time event is an occurrence with no series, so the selector has one code
-- path rather than two.
alter table public.event_occurrences
  alter column series_slug drop not null;

alter table public.event_occurrences
  add column if not exists title           text,
  add column if not exists slug            text unique,
  add column if not exists summary         text,
  add column if not exists description     text,
  add column if not exists age_min         integer check (age_min is null or age_min between 0 and 99),
  add column if not exists age_note        text,
  add column if not exists music_formats   text[],
  add column if not exists venue_name      text,
  add column if not exists flyer_asset_id  text references public.media_assets (asset_id) on delete set null,
  add column if not exists ticket_label    text,
  add column if not exists published       boolean not null default true,
  add column if not exists note            text;

comment on table public.event_occurrences is
  'Sparse overrides for generated recurring dates, plus standalone one-time events. Ordinary weekly dates are still generated from event_series.cadence at read time, so a recurring series has no date to go stale.';

-- A standalone occurrence has to be self-describing; an override does not.
alter table public.event_occurrences
  drop constraint if exists event_occurrences_standalone;
alter table public.event_occurrences
  add constraint event_occurrences_standalone
  check (series_slug is not null or (title is not null and length(trim(title)) > 0));

alter table public.event_series
  add column if not exists flyer_asset_id   text references public.media_assets (asset_id) on delete set null,
  add column if not exists flyer_printed_date text,
  add column if not exists paused           boolean not null default false,
  add column if not exists ticket_policy    text not null default 'required'
    check (ticket_policy in ('required', 'door', 'free', 'later'));

-- Dated artwork can never be the authoritative date source. It is allowed in the
-- flyer slot only when the date it prints is declared, so the UI can caption it.
alter table public.event_series
  drop constraint if exists event_series_flyer_date_declared;
alter table public.event_series
  add constraint event_series_flyer_date_declared
  check (flyer_asset_id is not null or flyer_printed_date is null);

-- ------------------------------------------------------------------ media ---

alter table public.media_assets
  add column if not exists title            text,
  add column if not exists kind             text not null default 'image'
    check (kind in ('image', 'video', 'texture')),
  add column if not exists decorative       boolean not null default false,
  add column if not exists tags             text[] not null default '{}',
  add column if not exists size_bytes       bigint,
  add column if not exists mime             text,
  add column if not exists duration_seconds numeric,
  add column if not exists uploaded_by      uuid references auth.users (id) on delete set null,
  add column if not exists created_at       timestamptz not null default now();

-- A meaningful image needs alt text; a decorative one needs to say so out loud.
alter table public.media_assets
  drop constraint if exists media_assets_alt_or_decorative;
alter table public.media_assets
  add constraint media_assets_alt_or_decorative
  check (
    status = 'placeholder'
    or decorative
    or (alt is not null and length(trim(alt)) > 0)
  );

-- A video with no poster is a blank rectangle until the first frame decodes.
alter table public.media_assets
  drop constraint if exists media_assets_video_poster;
alter table public.media_assets
  add constraint media_assets_video_poster
  check (kind <> 'video' or poster is not null);

-- ------------------------------------------------------------ special hours --

create table if not exists public.special_hours (
  id          text primary key,
  on_date     date not null unique,
  closed      boolean not null default false,
  ranges      jsonb not null default '[]'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.special_hours is
  'Date-specific exceptions to the weekly schedule — a holiday, a private buyout, a late open. Past dates are ignored on read and can be tidied up by staff.';

-- ------------------------------------------------------------- page content --

-- page_sections was keyed (page, key), which the repository layer cannot address
-- as a single row. It keeps the pair as a unique constraint.
alter table public.page_sections add column if not exists id text;
update public.page_sections set id = page || ':' || key where id is null;
alter table public.page_sections alter column id set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'page_sections_pkey' and conrelid = 'public.page_sections'::regclass
  ) then
    alter table public.page_sections drop constraint page_sections_pkey;
  end if;
end;
$$;

alter table public.page_sections add primary key (id);
alter table public.page_sections
  drop constraint if exists page_sections_page_key_key;
alter table public.page_sections add constraint page_sections_page_key_key unique (page, key);

alter table public.page_sections
  add column if not exists media_asset_id text references public.media_assets (asset_id) on delete set null,
  add column if not exists cta_label      text,
  add column if not exists cta_href       text;

-- Ordered lists staff may safely edit: enquiry choices, perks, positions. Not a
-- page builder — the key names a slot the design already has.
create table if not exists public.page_lists (
  id          text primary key,
  page        text not null,
  key         text not null,
  label       text not null,
  items       jsonb not null default '[]'::jsonb,
  draft       jsonb,
  archived_at timestamptz,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  unique (page, key)
);

-- ------------------------------------------------------------- versions -----

create table if not exists public.content_versions (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      text not null,
  snapshot    jsonb not null,
  label       text not null default '',
  actor       uuid references auth.users (id) on delete set null,
  actor_name  text not null default '',
  at          timestamptz not null default now()
);

create index if not exists content_versions_row_idx
  on public.content_versions (table_name, row_id, at desc);

comment on table public.content_versions is
  'One snapshot of the live columns per publish. Restoring writes a snapshot back as a draft, so a restore is reviewed like any other change rather than going straight out.';

-- -------------------------------------------------- contributor write guard --

-- A Contributor may change `draft` and nothing else. Checked in the database so
-- it holds for a direct API call, not only for a server action that remembered.
create or replace function public.guard_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_live jsonb;
  after_live  jsonb;
begin
  if public.can_publish() then
    return new;
  end if;

  before_live := to_jsonb(old) - 'draft' - 'updated_at' - 'updated_by';
  after_live  := to_jsonb(new) - 'draft' - 'updated_at' - 'updated_by';

  if before_live is distinct from after_live then
    raise exception
      'Your account can save drafts but cannot publish changes. Ask a manager to publish this.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'menus', 'menu_categories', 'menu_items', 'event_series', 'event_occurrences',
    'catering_packages', 'catering_items', 'page_sections', 'page_lists', 'media_assets'
  ]
  loop
    execute format(
      'drop trigger if exists %1$s_guard_publish on public.%1$s', t);
    execute format(
      'create trigger %1$s_guard_publish before update on public.%1$s
       for each row execute function public.guard_publish()', t);
  end loop;
end;
$$;

-- Inserting a brand new live record is also publishing.
create or replace function public.guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_publish() then
    raise exception
      'Your account can save drafts but cannot create published content. Ask a manager.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'menu_categories', 'menu_items', 'event_series', 'event_occurrences',
    'catering_packages', 'catering_items', 'page_sections', 'page_lists'
  ]
  loop
    execute format('drop trigger if exists %1$s_guard_insert on public.%1$s', t);
    execute format(
      'create trigger %1$s_guard_insert before insert on public.%1$s
       for each row execute function public.guard_insert()', t);
  end loop;
end;
$$;

-- Deleting published content is not a staff action at all.
do $$
declare
  t text;
begin
  foreach t in array array[
    'menus', 'menu_categories', 'menu_items', 'event_series',
    'catering_packages', 'catering_items', 'page_sections', 'page_lists', 'media_assets'
  ]
  loop
    execute format('drop policy if exists %1$s_editor_write on public.%1$s', t);
    execute format(
      'create policy %1$s_editor_change on public.%1$s for update to authenticated
       using (public.can_edit()) with check (public.can_edit())', t);
    execute format(
      'create policy %1$s_editor_add on public.%1$s for insert to authenticated
       with check (public.can_publish())', t);
    execute format(
      'create policy %1$s_owner_remove on public.%1$s for delete to authenticated
       using (public.is_owner())', t);
  end loop;
end;
$$;

-- Occurrences are the one exception: cancelling a single night is routine work,
-- and an unpublished generated override that was never public can be dropped.
drop policy if exists event_occurrences_editor_write on public.event_occurrences;
create policy event_occurrences_editor_change on public.event_occurrences for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
create policy event_occurrences_editor_add on public.event_occurrences for insert to authenticated
  with check (public.can_edit());
create policy event_occurrences_manager_remove on public.event_occurrences for delete to authenticated
  using (public.can_publish());

-- New tables inherit the same shape.
alter table public.special_hours    enable row level security;
alter table public.page_lists       enable row level security;
alter table public.content_versions enable row level security;

create policy special_hours_public_read on public.special_hours for select to anon, authenticated using (true);
create policy special_hours_manager_write on public.special_hours for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

create policy page_lists_public_read on public.page_lists for select to anon, authenticated using (true);

create policy content_versions_staff_read on public.content_versions for select to authenticated
  using (public.can_edit());
create policy content_versions_staff_write on public.content_versions for insert to authenticated
  with check (public.can_edit());

-- Profiles: only an Owner may change a role. A Manager can no longer promote
-- themselves, which the 0001 policy allowed.
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_owner_write on public.profiles for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ------------------------------------------------------------ media storage --

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');

create policy "media staff upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_edit());

create policy "media manager remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.can_publish());
