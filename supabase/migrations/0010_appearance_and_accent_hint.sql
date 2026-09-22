-- The appearance row, and the flyer's own colour on the event.
--
-- One row (id = 1) decides how the website and the admin look: a preset,
-- two dials, a season. It is read server-side in the root layout and emitted
-- as CSS custom properties, so changing the look is a database write — no
-- rebuild, no redeploy. `accent_hint` is the dominant colour of an event's
-- flyer, extracted on upload, for the event page's surface tint.
--
-- Rollback:
--   alter table public.event_occurrences drop column if exists accent_hint;
--   drop table if exists public.appearance;

create table if not exists public.appearance (
  id                     int primary key default 1 check (id = 1),
  preset                 text not null default 'evening' check (preset in ('evening', 'aperitivo', 'nocturne', 'daylight')),
  surface_hex            text check (surface_hex is null or surface_hex ~ '^#[0-9a-fA-F]{6}$'),
  accent_hex             text check (accent_hex is null or accent_hex ~ '^#[0-9a-fA-F]{6}$'),
  season                 text not null default 'none' check (season in ('none', 'halloween', 'nocturne', 'winter', 'spring')),
  decorations_enabled    boolean not null default true,
  decoration_intensity   text not null default 'subtle' check (decoration_intensity in ('subtle', 'lively')),
  admin_follows_site     boolean not null default true,
  updated_at             timestamptz not null default now(),
  updated_by             text
);
comment on table public.appearance is
  'The one row that decides how the website and the admin look: a preset, two dials, a season. Read server-side in the root layout; a save is a database write, never a redeploy.';

alter table public.appearance enable row level security;
drop policy if exists appearance_public_read on public.appearance;
create policy appearance_public_read on public.appearance for select to anon, authenticated using (true);
drop policy if exists appearance_manager_write on public.appearance;
create policy appearance_manager_write on public.appearance for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

insert into public.appearance (id) values (1) on conflict (id) do nothing;

alter table public.event_occurrences add column if not exists accent_hint text
  check (accent_hint is null or accent_hint ~ '^#[0-9a-fA-F]{6}$');
comment on column public.event_occurrences.accent_hint is 'Dominant colour of the flyer, extracted on upload, for the event page surface tint.';
