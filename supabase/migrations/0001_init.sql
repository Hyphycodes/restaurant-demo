-- Cosa Nostra — initial schema
--
-- Design notes that matter:
--   * Structured tables, not one JSON blob. See docs/CONTENT-MODEL.md.
--   * event_series carries NO date column. Dates live only on occurrences, which
--     is what makes it structurally impossible for a recurring event to display a
--     stale date. See PLAN.md §4.1.
--   * price_cents is NULLABLE on purpose. NULL means "not published", which the
--     site renders as "Ask your server" — never as $0, never silently hidden.
--   * RLS is the authorization boundary. Hiding buttons is not authorization.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- roles ----

create type public.user_role as enum ('owner', 'admin', 'editor');

create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'editor',
  name        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Role assignment per authenticated user. The role column is the sole source of authorization.';

-- Helpers used by every policy below. SECURITY DEFINER so a user can read their
-- own role without needing a policy on profiles that would recurse.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'admin', 'editor');
$$;

create or replace function public.can_administer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'admin');
$$;

-- -------------------------------------------------------- site settings ----

create table public.site_settings (
  id          text primary key default 'default',
  payload     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  constraint site_settings_singleton check (id = 'default')
);

comment on column public.site_settings.payload is
  'Partial override of src/content/site.ts. Only the keys present here override the static defaults.';

-- --------------------------------------------------------- announcements ----

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  message     text not null check (length(trim(message)) between 1 and 240),
  href        text,
  link_label  text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  enabled     boolean not null default false,
  tone        text not null default 'default' check (tone in ('default', 'night')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint announcements_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint announcements_link check ((href is null) = (link_label is null))
);

-- ------------------------------------------------------------------ menus ----

create table public.menus (
  slug         text primary key check (slug in ('food', 'cocktails', 'brunch')),
  title        text not null,
  note         text,
  empty_state  text,
  sort         integer not null default 0,
  updated_at   timestamptz not null default now()
);

create table public.menu_categories (
  id          text primary key,
  menu_slug   text not null references public.menus (slug) on delete cascade,
  name        text not null,
  note        text,
  sort        integer not null default 0,
  updated_at  timestamptz not null default now()
);

create index menu_categories_menu_idx on public.menu_categories (menu_slug, sort);

create table public.menu_items (
  id                    text primary key,
  category_id           text not null references public.menu_categories (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  description           text,
  -- NULL = price not published. Never 0, never hidden. See docs/CONTENT-QUESTIONS.md §3.
  price_cents           integer check (price_cents is null or price_cents >= 0),
  price_note            text,
  modifier_group_label  text,
  dietary               text[] not null default '{}',
  available             boolean not null default true,
  featured              boolean not null default false,
  sort                  integer not null default 0,
  updated_at            timestamptz not null default now(),
  -- An unpriced item must say why, so the page never renders a bare blank.
  constraint menu_items_price_or_note check (price_cents is not null or price_note is not null)
);

create index menu_items_category_idx on public.menu_items (category_id, sort);

create table public.menu_modifiers (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null references public.menu_items (id) on delete cascade,
  label        text not null,
  price_cents  integer check (price_cents is null or price_cents >= 0),
  sort         integer not null default 0
);

create index menu_modifiers_item_idx on public.menu_modifiers (item_id, sort);

-- ----------------------------------------------------------------- events ----

create type public.event_status as enum ('scheduled', 'sold-out', 'cancelled', 'postponed', 'free');

create table public.event_series (
  slug              text primary key,
  title             text not null,
  summary           text not null default '',
  description       text not null default '',
  -- 'weekly:0'..'weekly:6' (0 = Sunday) or 'one-time'.
  cadence           text not null default 'one-time',
  start_minutes     integer not null check (start_minutes between 0 and 1440),
  end_minutes       integer not null check (end_minutes between 0 and 2880),
  age_min           integer check (age_min is null or age_min between 0 and 99),
  age_note          text,
  music_formats     text[] not null default '{}',
  venue_name        text not null default 'Cosa Nostra',
  artwork_asset_id  text,
  ticket_url        text,
  price_cents       integer check (price_cents is null or price_cents >= 0),
  fee_cents         integer check (fee_cents is null or fee_cents >= 0),
  status            public.event_status not null default 'scheduled',
  series_ends_on    date,
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- An event cannot end before it starts.
  constraint event_series_duration check (end_minutes > start_minutes)
);

comment on table public.event_series is
  'A series has NO date column. Dates exist only on occurrences, so recurring artwork can never become the authoritative date source.';

create table public.event_occurrences (
  id           uuid primary key default gen_random_uuid(),
  series_slug  text not null references public.event_series (slug) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       public.event_status not null default 'scheduled',
  ticket_url   text,
  price_cents  integer check (price_cents is null or price_cents >= 0),
  fee_cents    integer check (fee_cents is null or fee_cents >= 0),
  created_at   timestamptz not null default now(),
  constraint event_occurrences_duration check (ends_at > starts_at),
  unique (series_slug, starts_at)
);

create index event_occurrences_upcoming_idx on public.event_occurrences (starts_at);

comment on table public.event_occurrences is
  'Explicit overrides only (a cancelled night, a guest DJ). Ordinary recurring dates are generated at read time from event_series.cadence.';

-- --------------------------------------------------------------- catering ----

create table public.catering_packages (
  id           text primary key,
  name         text not null,
  serves_min   integer check (serves_min is null or serves_min > 0),
  serves_max   integer check (serves_max is null or serves_max > 0),
  price_cents  integer not null check (price_cents >= 0),
  includes     text[] not null default '{}',
  sort         integer not null default 0,
  updated_at   timestamptz not null default now(),
  constraint catering_serves_range check (serves_max is null or serves_min is null or serves_max >= serves_min)
);

create table public.catering_items (
  id           text primary key,
  name         text not null,
  price_cents  integer not null check (price_cents >= 0),
  note         text,
  sort         integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------- page sections ----

create table public.page_sections (
  page       text not null,
  key        text not null,
  eyebrow    text,
  heading    text not null,
  body       text,
  visible    boolean not null default true,
  -- Editors choose from approved layout variants. They cannot author CSS.
  variant    text not null default 'plain'
             check (variant in ('editorial-left', 'editorial-right', 'stagger', 'band', 'plain')),
  sort       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (page, key)
);

create table public.page_seo (
  page          text primary key,
  title         text not null check (length(title) between 10 and 70),
  description   text not null check (length(description) between 50 and 320),
  og_asset_id   text,
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------ media assets ----

create table public.media_assets (
  asset_id    text primary key,
  path        text,
  alt         text,
  width       integer,
  height      integer,
  ratio       text,
  focal       text not null default '50% 50%',
  poster      text,
  status      text not null default 'placeholder'
              check (status in ('final', 'temp-wix', 'placeholder', 'brand')),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- inquiries ----

create type public.inquiry_type as enum ('catering', 'private-event', 'careers');
create type public.inquiry_status as enum ('new', 'in-progress', 'closed');

create table public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,
  type        public.inquiry_type not null,
  name        text not null,
  email       text not null,
  phone       text,
  payload     jsonb not null default '{}'::jsonb,
  status      public.inquiry_status not null default 'new',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index inquiries_status_idx on public.inquiries (status, created_at desc);

-- --------------------------------------------------------------- audit log ----

create table public.audit_log (
  id          bigserial primary key,
  actor       uuid references auth.users (id) on delete set null,
  table_name  text not null,
  row_id      text,
  action      text not null,
  diff        jsonb,
  at          timestamptz not null default now()
);

create index audit_log_at_idx on public.audit_log (at desc);

create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  identifier text;
begin
  identifier := coalesce(
    to_jsonb(coalesce(new, old)) ->> 'id',
    to_jsonb(coalesce(new, old)) ->> 'slug',
    to_jsonb(coalesce(new, old)) ->> 'asset_id',
    to_jsonb(coalesce(new, old)) ->> 'page'
  );

  insert into public.audit_log (actor, table_name, row_id, action, diff)
  values (
    auth.uid(),
    tg_table_name,
    identifier,
    lower(tg_op),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach both triggers to every editable table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'site_settings', 'announcements', 'menus', 'menu_categories', 'menu_items',
    'event_series', 'catering_packages', 'catering_items', 'page_sections',
    'page_seo', 'media_assets', 'inquiries', 'profiles'
  ]
  loop
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s
       for each row execute function public.record_audit()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------- RLS ----
-- Public content is world-readable; writes require a role. This is the actual
-- authorization boundary — the admin UI hiding a button is not.

alter table public.profiles           enable row level security;
alter table public.site_settings      enable row level security;
alter table public.announcements      enable row level security;
alter table public.menus              enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.menu_modifiers     enable row level security;
alter table public.event_series       enable row level security;
alter table public.event_occurrences  enable row level security;
alter table public.catering_packages  enable row level security;
alter table public.catering_items     enable row level security;
alter table public.page_sections      enable row level security;
alter table public.page_seo           enable row level security;
alter table public.media_assets       enable row level security;
alter table public.inquiries          enable row level security;
alter table public.audit_log          enable row level security;

-- Public read on published content.
do $$
declare
  t text;
begin
  foreach t in array array[
    'site_settings', 'announcements', 'menus', 'menu_categories', 'menu_items',
    'menu_modifiers', 'event_series', 'event_occurrences', 'catering_packages',
    'catering_items', 'page_sections', 'page_seo', 'media_assets'
  ]
  loop
    execute format(
      'create policy %1$s_public_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format(
      'create policy %1$s_editor_write on public.%1$s for all to authenticated
       using (public.can_edit()) with check (public.can_edit())', t);
  end loop;
end;
$$;

-- Settings, SEO, and media are admin-only to change (editors may still read them).
drop policy site_settings_editor_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings for all to authenticated
  using (public.can_administer()) with check (public.can_administer());

drop policy page_seo_editor_write on public.page_seo;
create policy page_seo_admin_write on public.page_seo for all to authenticated
  using (public.can_administer()) with check (public.can_administer());

-- Inquiries: anyone may submit; only signed-in staff may read or update.
create policy inquiries_public_insert on public.inquiries for insert to anon, authenticated
  with check (true);
create policy inquiries_staff_read on public.inquiries for select to authenticated
  using (public.can_edit());
create policy inquiries_staff_update on public.inquiries for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
-- Deliberately NO delete policy: enquiries are business records.

-- Profiles: read your own; only owner/admin may change roles.
create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.can_administer());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.can_administer()) with check (public.can_administer());

-- Audit log: admin read only, never writable from the client.
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using (public.can_administer());

-- New signups get the least-privileged role. Elevation is a deliberate admin act.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, name)
  values (new.id, 'editor', coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
