-- Event flyers, and the removal of published ticket fees.
--
-- 1. `flyer_asset_id` / `flyer_printed_date`
--
--    `artwork_asset_id` is the UNDATED series artwork slot: anything with a date
--    baked into the pixels is rejected there by both the content test and
--    scripts/check-assets.ts, because a recurring series must never let artwork
--    become its authoritative date source.
--
--    The restaurant's real flyers do carry a printed date. Rather than refuse to
--    show them, they get their own slot alongside the date they print, so the UI
--    can caption the artwork ("Series artwork, printed for August 8th") and the
--    live next date — always generated from cadence — stays the only date a
--    visitor is asked to act on.
--
--    The pair is enforced: a flyer may not be stored without its printed date
--    unless the artwork genuinely carries none, which is recorded explicitly.
--
-- 2. `fee_cents`
--
--    Ticket service fees change at the ticketing provider, not here. Publishing
--    "+$0.25 fee" on the website guaranteed the site would eventually quote a
--    fee the guest was not charged. The checkout page is the source of truth for
--    the final total, so the column goes rather than being left to drift.

alter table public.event_series
  add column if not exists flyer_asset_id     text,
  add column if not exists flyer_printed_date text;

comment on column public.event_series.flyer_asset_id is
  'Restaurant-supplied series flyer. May carry a printed date — unlike artwork_asset_id.';
comment on column public.event_series.flyer_printed_date is
  'The date printed on the flyer, in the venue''s own wording ("August 8th"). Required whenever the flyer image is tagged containsText: ''date'', so the artwork is always captioned.';

alter table public.event_series  drop column if exists fee_cents;
alter table public.event_occurrences drop column if exists fee_cents;
