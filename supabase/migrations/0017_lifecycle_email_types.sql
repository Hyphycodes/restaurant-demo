-- Room in the email log for the two lifecycle stages that are built but off.
--
-- `tonight` (a few hours before doors) and `thanks` (the morning after) are
-- written and wired in src/app/api/cron/reminders/route.ts with `enabled:
-- false`. The log is also how a repeat is prevented for those two — they have
-- no column of their own, on purpose, because a stage that may never be turned
-- on should not leave a column behind — so the constraint has to accept them
-- before either can ever send.
--
-- Rollback: restore the 0009 check (confirmation, reminder, resend,
-- owner_alert, cancellation).

do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.email_log'::regclass and contype = 'c'
  loop
    if doomed.def ilike '%confirmation%' and doomed.def not ilike '%tonight%' then
      execute format('alter table public.email_log drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.email_log drop constraint if exists email_log_type_known;
alter table public.email_log add constraint email_log_type_known
  check (type in ('confirmation', 'reminder', 'resend', 'tonight', 'thanks', 'owner_alert', 'cancellation'));
