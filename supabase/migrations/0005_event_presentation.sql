-- Casa Aurelia events become a first-class, presentable CMS object.
--
-- The shape does NOT change: a recurring night is still an `event_series` with
-- no date, and a one-off event is still an `event_occurrences` row with no
-- series. That is what keeps a recurring event from ever showing a stale date.
-- What this migration adds is everything the website needs in order to PRESENT
-- an event well, plus the bookkeeping for importing the calendar from Tickeri.
--
-- THE FLYER RULE.
-- `flyer_asset_id` already exists and holds the restaurant's official flyer —
-- the artwork the event was actually promoted with. This migration does not
-- touch it, and the three new artwork columns are deliberately separate slots.
-- Website key art is secondary art; it never overwrites the flyer, and an event
-- with no key art falls back to showing its flyer. Enforced in the server
-- actions and asserted in src/server/content/events-presentation.test.ts.

-- --------------------------------------------------------------- vocabulary --

-- Kept as text + check constraints rather than enums: adding a category later
-- should be a one-line migration, not an ALTER TYPE with a rewrite.

do $$
declare
  t text;
begin
  foreach t in array array['event_series', 'event_occurrences']
  loop
    execute format($f$
      alter table public.%I
        add column if not exists category text,
        add column if not exists price_text text,
        add column if not exists key_art_asset_id text references public.media_assets (asset_id) on delete set null,
        add column if not exists key_art_mobile_asset_id text references public.media_assets (asset_id) on delete set null,
        add column if not exists foreground_asset_id text references public.media_assets (asset_id) on delete set null,
        add column if not exists visual_preset text not null default 'brass',
        add column if not exists featured boolean not null default false,
        add column if not exists priority integer not null default 0,
        add column if not exists treatment text not null default 'standard',
        add column if not exists takeover_start_at timestamptz,
        add column if not exists takeover_end_at timestamptz
    $f$, t);

    execute format($f$
      alter table public.%I drop constraint if exists %I
    $f$, t, t || '_category_known');
    execute format($f$
      alter table public.%I add constraint %I
        check (category is null or category in ('nightlife','vinyl-vermouth','brunch','comedy','special'))
    $f$, t, t || '_category_known');

    execute format($f$
      alter table public.%I drop constraint if exists %I
    $f$, t, t || '_preset_known');
    execute format($f$
      alter table public.%I add constraint %I
        check (visual_preset in ('brass','bone','blood','candy','neon','midnight','gold'))
    $f$, t, t || '_preset_known');

    execute format($f$
      alter table public.%I drop constraint if exists %I
    $f$, t, t || '_treatment_known');
    execute format($f$
      alter table public.%I add constraint %I
        check (treatment in ('standard','featured','takeover'))
    $f$, t, t || '_treatment_known');

    -- A takeover with no window would never end. A window that ends before it
    -- starts would never begin. Both are refused at the database.
    execute format($f$
      alter table public.%I drop constraint if exists %I
    $f$, t, t || '_takeover_window');
    execute format($f$
      alter table public.%I add constraint %I
        check (
          treatment <> 'takeover'
          or (takeover_start_at is not null and takeover_end_at is not null
              and takeover_end_at > takeover_start_at)
        )
    $f$, t, t || '_takeover_window');

    execute format($f$comment on column public.%I.key_art_asset_id is
      'Secondary WEBSITE art. Never the official flyer — that is flyer_asset_id, which this must not overwrite.'$f$, t);
  end loop;
end;
$$;

comment on column public.event_occurrences.price_text is
  'What the guest pays, in words, when a single number cannot say it — "$25 · record and paint included". price_cents stays the machine-readable value when there is one.';
comment on column public.event_occurrences.priority is
  'Manual tie-break inside a treatment. Higher wins. Dates still order the list; this only decides which of two same-day events leads.';

-- ------------------------------------------------------------- import trail --

-- Where a record came from, so a re-import can update the row it created rather
-- than making a second copy of the same night. Only occurrences carry this:
-- Tickeri sells dated events, which is exactly what an occurrence is.
alter table public.event_occurrences
  add column if not exists source text not null default 'manual',
  add column if not exists source_event_id text,
  add column if not exists source_url text,
  add column if not exists synced_at timestamptz;

alter table public.event_occurrences drop constraint if exists event_occurrences_source_known;
alter table public.event_occurrences add constraint event_occurrences_source_known
  check (source in ('manual', 'tickeri'));

-- One row per imported Tickeri event. Partial, so manual rows are unconstrained.
create unique index if not exists event_occurrences_source_event_idx
  on public.event_occurrences (source, source_event_id)
  where source_event_id is not null;

comment on column public.event_occurrences.source_event_id is
  'Tickeri''s own event id. The reconcile job matches on this, so re-running it updates instead of duplicating.';

-- A one-off event needs its own public URL, and the slug is that URL. Already
-- unique from 0003; this backfills the ones that never got one.
update public.event_occurrences
   set slug = regexp_replace(lower(trim(title)), '[^a-z0-9]+', '-', 'g')
 where slug is null and title is not null and length(trim(title)) > 0;

-- ------------------------------------------------------------------ ordering --

create index if not exists event_occurrences_upcoming_idx
  on public.event_occurrences (starts_at)
  where archived_at is null;

create index if not exists event_occurrences_treatment_idx
  on public.event_occurrences (treatment, starts_at)
  where archived_at is null and treatment <> 'standard';
