-- Email delivery records, for the communications system.
--
-- `email_log` (0009) recorded one row per attempt with a type, a recipient,
-- the provider id and an error. This widens it into a delivery record:
--
--   event_id, template   which event and which React Email template, so the
--                        Communications screen can filter by night
--   subject              what the inbox saw (no body is ever stored)
--   is_test              a staff test send, never a real guest
--   provider_status,     what Resend said afterwards, written by the webhook
--   delivered_at,        at /api/webhooks/resend
--   last_event_at
--
-- and lets the type and status checks accept the new emails (refund, event
-- update, staff invitation, the auth emails) and the provider outcomes
-- (delivered, delayed, bounced, complained).
--
-- The code tolerates this migration NOT being applied: an insert that fails
-- on a missing column or the older check is retried in the 0009 shape. So
-- nothing breaks before it runs; the extra columns simply stay empty.
--
-- Rollback:
--   alter table public.email_log
--     drop column if exists event_id, drop column if exists template,
--     drop column if exists subject, drop column if exists is_test,
--     drop column if exists provider_status, drop column if exists delivered_at,
--     drop column if exists last_event_at;
--   then restore the 0017 type check and the 0009 status check.

alter table public.email_log
  add column if not exists event_id        text,
  add column if not exists template        text,
  add column if not exists subject         text,
  add column if not exists is_test         boolean not null default false,
  add column if not exists provider_status text,
  add column if not exists delivered_at    timestamptz,
  add column if not exists last_event_at   timestamptz;

comment on column public.email_log.event_id is 'The event_occurrences id the email was about, when it was about one.';
comment on column public.email_log.template is 'The React Email template id (src/emails/registry.ts).';
comment on column public.email_log.is_test is 'A staff test send from the admin. Never a real guest.';
comment on column public.email_log.provider_status is 'The last thing the delivery webhook said: a bounce reason, a delay note.';

-- The type check: drop whichever name it has, then declare the full list.
do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.email_log'::regclass and contype = 'c'
  loop
    if doomed.def ilike '%confirmation%' or doomed.def ilike '%skipped%' then
      execute format('alter table public.email_log drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.email_log add constraint email_log_type_known
  check (type in (
    'confirmation', 'reminder', 'tonight', 'resend', 'thanks',
    'refund', 'event_update', 'cancellation',
    'staff_invitation', 'magic_link', 'password_reset', 'verify_email', 'welcome',
    'owner_alert'
  ));

alter table public.email_log add constraint email_log_status_known
  check (status in ('sent', 'failed', 'skipped', 'delivered', 'delayed', 'bounced', 'complained'));

-- The webhook finds a row by the provider's id; the admin lists by event.
create index if not exists email_log_provider_idx on public.email_log (provider_id) where provider_id is not null;
create index if not exists email_log_event_idx on public.email_log (event_id, created_at desc) where event_id is not null;
create index if not exists email_log_created_idx on public.email_log (created_at desc);
