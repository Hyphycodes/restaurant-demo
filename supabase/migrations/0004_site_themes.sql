-- Casa Aurelia seasonal themes.
--
-- One row per seasonal look the website can wear. The public site reads this
-- table during server rendering and resolves, in America/Chicago time, whether
-- an enabled theme is inside its window; if it is not, or if the table cannot be
-- read at all, the site renders the default Casa Aurelia design. See
-- docs/seasonal-theme-admin.md.
--
-- Why a table and not a key in site_settings.payload: a theme carries a
-- schedule and a set of artwork overrides, and a second one will carry its own.
-- That is a record per theme, not a sparse override of business facts.

create table if not exists public.site_themes (
  slug             text primary key,
  name             text not null,
  enabled          boolean not null default false,
  schedule_enabled boolean not null default false,
  start_at         timestamptz,
  end_at           timestamptz,
  -- { options: {texture,glow,petals,edges,motion}, intensity, assets: {slot: media_assets.asset_id} }
  config           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  constraint site_themes_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint site_themes_window check (start_at is null or end_at is null or end_at > start_at)
);

comment on table public.site_themes is
  'Seasonal art-direction layers the public site can switch on. The admin toggles, schedules and configures them; the code defines what each slug looks like.';
comment on column public.site_themes.config is
  'Creative options only — on/off switches, an intensity, and artwork overrides by media asset id. Never raw CSS values.';

-- Keep updated_at honest, like every other table.
drop trigger if exists site_themes_touch on public.site_themes;
create trigger site_themes_touch
  before update on public.site_themes
  for each row execute function public.touch_updated_at();

-- The site reads it anonymously during SSR; only Owner and Manager change it.
alter table public.site_themes enable row level security;

drop policy if exists site_themes_public_read on public.site_themes;
create policy site_themes_public_read on public.site_themes
  for select to anon, authenticated using (true);

drop policy if exists site_themes_manager_write on public.site_themes;
create policy site_themes_manager_write on public.site_themes
  for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

-- The first theme, switched off, so the admin screen has a record to edit.
insert into public.site_themes (slug, name, enabled)
values ('autumn-evening', 'Halloween · Autumn evenings', false)
on conflict (slug) do nothing;
