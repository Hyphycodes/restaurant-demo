-- Native Cosa Nostra Link Hubs: permanent destinations, scheduled modes, composable
-- blocks, privacy-conscious interaction events, and lead capture.

create table if not exists public.link_hub_locations (
  id                text primary key,
  name              text not null,
  address           text,
  phone             text,
  review_url        text,
  directions_url    text,
  reservation_url   text,
  menu_url          text,
  instagram_url     text,
  tiktok_url        text,
  facebook_url      text,
  contact_email     text,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.link_hubs (
  id                   uuid primary key default gen_random_uuid(),
  location_id          text references public.link_hub_locations (id) on delete set null,
  name                 text not null check (length(trim(name)) between 1 and 100),
  slug                 text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  internal_description text not null default '',
  hub_type             text not null default 'custom',
  theme                text not null default 'cosa-nostra-default',
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title                text not null,
  subtitle             text,
  logo_asset_id        text references public.media_assets (asset_id) on delete set null,
  background_asset_id  text references public.media_assets (asset_id) on delete set null,
  hero_asset_id        text references public.media_assets (asset_id) on delete set null,
  custom_theme         jsonb not null default '{}'::jsonb,
  start_at             timestamptz,
  end_at               timestamptz,
  mode_strategy        text not null default 'auto' check (mode_strategy in ('auto', 'manual')),
  manual_mode_id       uuid,
  search_visibility    text not null default 'noindex' check (search_visibility in ('searchable', 'noindex')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint link_hubs_window check (end_at is null or start_at is null or end_at > start_at)
);

create unique index if not exists link_hubs_slug_lower_idx on public.link_hubs (lower(slug));
create index if not exists link_hubs_status_idx on public.link_hubs (status, updated_at desc);

create table if not exists public.link_hub_modes (
  id                uuid primary key default gen_random_uuid(),
  hub_id            uuid not null references public.link_hubs (id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 80),
  title_override    text,
  subtitle_override text,
  enabled           boolean not null default true,
  priority          integer not null default 0,
  days_of_week      smallint[] not null default '{}',
  start_time        time,
  end_time          time,
  starts_on         date,
  ends_on           date,
  active_event_only boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint link_hub_modes_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

alter table public.link_hubs
  add constraint link_hubs_manual_mode_fk
  foreign key (manual_mode_id) references public.link_hub_modes (id) on delete set null;

create index if not exists link_hub_modes_hub_idx on public.link_hub_modes (hub_id, priority desc);

create table if not exists public.link_hub_blocks (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid not null references public.link_hubs (id) on delete cascade,
  mode_id     uuid references public.link_hub_modes (id) on delete cascade,
  block_type  text not null,
  label       text not null default '',
  config      jsonb not null default '{}'::jsonb,
  sort        integer not null default 0,
  visible     boolean not null default true,
  start_at    timestamptz,
  end_at      timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint link_hub_blocks_window check (end_at is null or start_at is null or end_at > start_at)
);

create index if not exists link_hub_blocks_hub_mode_sort_idx
  on public.link_hub_blocks (hub_id, mode_id, sort);

create table if not exists public.link_hub_analytics (
  id          bigserial primary key,
  hub_id      uuid not null references public.link_hubs (id) on delete cascade,
  block_id    uuid references public.link_hub_blocks (id) on delete set null,
  event_kind  text not null check (event_kind in (
    'view', 'block_click', 'event_click', 'review_click', 'reservation_click',
    'ticket_click', 'social_click', 'lead_submit', 'display_view'
  )),
  session_key text,
  referrer    text,
  utm         jsonb not null default '{}'::jsonb,
  device      text check (device is null or device in ('mobile', 'tablet', 'desktop', 'unknown')),
  target      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists link_hub_analytics_hub_time_idx
  on public.link_hub_analytics (hub_id, created_at desc);
create index if not exists link_hub_analytics_hub_kind_time_idx
  on public.link_hub_analytics (hub_id, event_kind, created_at desc);
create index if not exists link_hub_analytics_session_idx
  on public.link_hub_analytics (hub_id, session_key) where session_key is not null;

create table if not exists public.link_hub_leads (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid not null references public.link_hubs (id) on delete cascade,
  block_id    uuid references public.link_hub_blocks (id) on delete set null,
  name        text not null check (length(trim(name)) between 1 and 100),
  email       text not null check (length(trim(email)) between 3 and 320),
  phone       text,
  birthday    date,
  status      text not null default 'new' check (status in ('new', 'contacted', 'subscribed', 'closed')),
  source      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists link_hub_leads_hub_time_idx
  on public.link_hub_leads (hub_id, created_at desc);

-- The known Chicago destinations come from the same verified source as
-- src/content/site.ts. review_url stays NULL until Cosa Nostra supplies its direct
-- Google review link; a review block then renders a configuration warning in
-- admin instead of sending guests to a guessed destination.
insert into public.link_hub_locations (
  id, name, address, phone, review_url, directions_url, reservation_url,
  menu_url, instagram_url, tiktok_url, facebook_url
) values (
  'chicago',
  'Cosa Nostra — Chicago',
  'West Loop, Chicago, IL ',
  '(312) 555-0147',
  null,
  '/contact',
  'https://example.invalid/demo',
  '/menu',
  'https://example.invalid/demo',
  'https://example.invalid/demo',
  '/contact'
) on conflict (id) do nothing;

-- Keep updated_at and the audit trail consistent with the existing CMS.
do $$
declare
  t text;
begin
  foreach t in array array['link_hub_locations', 'link_hubs', 'link_hub_modes', 'link_hub_blocks', 'link_hub_leads']
  loop
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;

  foreach t in array array['link_hub_locations', 'link_hubs', 'link_hub_modes', 'link_hub_blocks']
  loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s
       for each row execute function public.record_audit()', t);
  end loop;
end;
$$;

create or replace function public.guard_link_hub_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and not public.can_publish() then
    raise exception 'Only a manager can publish a link hub' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger link_hubs_publish_guard
  before insert or update on public.link_hubs
  for each row execute function public.guard_link_hub_publish();

alter table public.link_hub_locations enable row level security;
alter table public.link_hubs enable row level security;
alter table public.link_hub_modes enable row level security;
alter table public.link_hub_blocks enable row level security;
alter table public.link_hub_analytics enable row level security;
alter table public.link_hub_leads enable row level security;

create policy link_hub_locations_public_read on public.link_hub_locations
  for select to anon, authenticated using (enabled or public.can_edit());
create policy link_hub_locations_staff_write on public.link_hub_locations
  for all to authenticated using (public.can_administer()) with check (public.can_administer());

create policy link_hubs_public_read on public.link_hubs
  for select to anon, authenticated using (
    status = 'published'
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at > now())
    or public.can_edit()
  );
create policy link_hubs_staff_write on public.link_hubs
  for all to authenticated using (public.can_edit()) with check (public.can_edit());

create policy link_hub_modes_public_read on public.link_hub_modes
  for select to anon, authenticated using (
    exists (select 1 from public.link_hubs h where h.id = hub_id and h.status = 'published')
    or public.can_edit()
  );
create policy link_hub_modes_staff_write on public.link_hub_modes
  for all to authenticated using (public.can_edit()) with check (public.can_edit());

create policy link_hub_blocks_public_read on public.link_hub_blocks
  for select to anon, authenticated using (
    exists (select 1 from public.link_hubs h where h.id = hub_id and h.status = 'published')
    or public.can_edit()
  );
create policy link_hub_blocks_staff_write on public.link_hub_blocks
  for all to authenticated using (public.can_edit()) with check (public.can_edit());

create policy link_hub_analytics_public_insert on public.link_hub_analytics
  for insert to anon, authenticated with check (
    exists (select 1 from public.link_hubs h where h.id = hub_id and h.status = 'published')
  );
create policy link_hub_analytics_staff_read on public.link_hub_analytics
  for select to authenticated using (public.can_edit());

create policy link_hub_leads_public_insert on public.link_hub_leads
  for insert to anon, authenticated with check (
    exists (select 1 from public.link_hubs h where h.id = hub_id and h.status = 'published')
  );
create policy link_hub_leads_staff_read on public.link_hub_leads
  for select to authenticated using (public.can_edit());
create policy link_hub_leads_staff_update on public.link_hub_leads
  for update to authenticated using (public.can_edit()) with check (public.can_edit());
