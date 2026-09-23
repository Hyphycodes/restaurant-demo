-- Enquiries become a small private-events & catering pipeline.
--
-- The admin's Enquiries screen used to be an inbox with three states: new,
-- in-progress, closed. An owner selling rehearsal dinners and office lunches
-- thinks in five: New → Contacted → Planning → Booked → Closed. This migration
-- gives the table those five stages and three light fields, and nothing more:
--
--   * next_step          what happens next, in one line ("Send the Grand
--                        Evening menu"), so the board reads like a to-do list;
--   * follow_up_on       the day somebody should chase it (a date, not a time;
--                        the venue is in one time zone);
--   * status_changed_at  when it last moved stage, for "booked this month" and
--                        the timeline on the detail screen.
--
-- It is still not a CRM: no owner, no deal value, no score, and still no delete
-- policy — an enquiry is a business record.
--
-- Why the enum is rebuilt rather than extended: `alter type ... add value`
-- cannot be followed, in the same transaction, by a statement that USES the new
-- value, and the legacy 'in-progress' rows must become 'contacted' here. So a
-- new type is created, the column is converted with a CASE mapping, the old
-- type is dropped and the new one renamed into its place — all valid inside the
-- single transaction a migration runs in. Nothing else depends on the type: no
-- function signature, view or policy mentions `inquiry_status` (checked against
-- 0001–0026); `inquiries_status_idx` is rebuilt automatically by the ALTER.
-- The RLS policies (public insert, staff read/update, no delete) and the
-- touch/audit triggers from 0001 are untouched.
--
-- Re-runnable: every step checks before it acts.
--
-- Rollback (by hand, if ever needed):
--   create type public.inquiry_status_old as enum ('new', 'in-progress', 'closed');
--   alter table public.inquiries alter column status drop default;
--   alter table public.inquiries alter column status type public.inquiry_status_old
--     using (case status::text when 'new' then 'new' when 'closed' then 'closed'
--            else 'in-progress' end)::public.inquiry_status_old;
--   alter table public.inquiries alter column status set default 'new';
--   drop type public.inquiry_status; alter type public.inquiry_status_old rename to inquiry_status;
--   drop trigger if exists inquiries_status_changed on public.inquiries;
--   drop function if exists public.inquiries_mark_status_change();
--   drop index if exists public.inquiries_board_idx;
--   alter table public.inquiries drop column next_step, drop column follow_up_on,
--     drop column status_changed_at;

-- ------------------------------------------------------- status enum ----

do $$
begin
  -- Already rebuilt (the five-stage type has 'planning')? Then nothing to do.
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typname = 'inquiry_status'
       and e.enumlabel = 'planning'
  ) then
    create type public.inquiry_status_v2 as enum ('new', 'contacted', 'planning', 'booked', 'closed');

    -- The default is typed with the old enum; it has to come off before the
    -- column can change type, and goes back on straight after.
    alter table public.inquiries alter column status drop default;

    alter table public.inquiries
      alter column status type public.inquiry_status_v2
      using (
        case status::text
          when 'in-progress' then 'contacted'
          when 'new' then 'new'
          when 'closed' then 'closed'
          else 'new'
        end
      )::public.inquiry_status_v2;

    alter table public.inquiries alter column status set default 'new';

    drop type public.inquiry_status;
    alter type public.inquiry_status_v2 rename to inquiry_status;
  end if;
end $$;

comment on type public.inquiry_status is
  'Enquiry pipeline stage: new → contacted → planning → booked → closed. The legacy ''in-progress'' became ''contacted'' in 0027.';

-- --------------------------------------------------- pipeline fields ----

alter table public.inquiries
  add column if not exists next_step         text,
  add column if not exists follow_up_on      date,
  add column if not exists status_changed_at timestamptz;

-- Length limits match the admin's validation, so the database is the last word.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.inquiries'::regclass
                    and conname = 'inquiries_next_step_length') then
    alter table public.inquiries add constraint inquiries_next_step_length
      check (next_step is null or length(next_step) <= 200);
  end if;
end $$;

-- Existing rows last "moved" when they were last touched. The touch and audit
-- triggers are paused for the backfill so it neither rewrites every
-- `updated_at` nor floods the audit log with a row per enquiry.
alter table public.inquiries disable trigger inquiries_touch;
alter table public.inquiries disable trigger inquiries_audit;

update public.inquiries
   set status_changed_at = coalesce(updated_at, created_at, now())
 where status_changed_at is null;

alter table public.inquiries enable trigger inquiries_touch;
alter table public.inquiries enable trigger inquiries_audit;

alter table public.inquiries alter column status_changed_at set default now();
alter table public.inquiries alter column status_changed_at set not null;

comment on column public.inquiries.next_step is
  'One line: what happens next on this enquiry. Staff-only.';
comment on column public.inquiries.follow_up_on is
  'The venue-local day somebody should chase this enquiry. Past and not closed = overdue on the board.';
comment on column public.inquiries.status_changed_at is
  'When the enquiry last moved stage. Kept honest by the inquiries_status_changed trigger as well as the app.';

-- The board reads by stage, soonest follow-up first.
create index if not exists inquiries_board_idx
  on public.inquiries (status, follow_up_on);

-- The app writes status_changed_at itself; this makes it true for any other
-- writer too (the SQL editor, a future integration).
create or replace function public.inquiries_mark_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.inquiries_mark_status_change() from public, anon, authenticated;

comment on function public.inquiries_mark_status_change() is
  'Trigger only (0027). Stamps status_changed_at when an enquiry changes stage.';

drop trigger if exists inquiries_status_changed on public.inquiries;
-- Plain `before update`, not `update of status`: a column list records a
-- dependency that would block any later ALTER of the column's type.
create trigger inquiries_status_changed
  before update on public.inquiries
  for each row execute function public.inquiries_mark_status_change();

-- ------------------------------------------------------ menu item image ----
-- The optional dish photograph needs no new column: menu_items.media_asset_id
-- (0003_admin_backend) already references media_assets. It is now read by
-- the public menu and set from the menu item editor.
