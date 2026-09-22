-- Which emails are switched on.
--
-- `src/emails/registry.ts` says what each email is and what triggers it.
-- This table says whether the owner currently wants it sent. A row exists
-- only once somebody has changed a default, so an empty table means
-- "everything as shipped" and a failed read means the same — the switch
-- can never be the reason a ticket does not arrive.
--
-- Only the optional emails are switchable (`switchable` in the registry).
-- A ticket, a refund, an event change or a sign-in link has no switch at
-- all: those are the ones somebody is owed, and the code never offers to
-- withhold them.
--
-- Rollback:
--   drop table if exists public.email_settings;

create table if not exists public.email_settings (
  template_id  text primary key,
  enabled      boolean not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);

comment on table public.email_settings is
  'Per-template on/off, set from Emails in the admin. A missing row means the shipped default.';
comment on column public.email_settings.template_id is
  'A TemplateId from src/emails/registry.ts. Not a foreign key: the registry lives in code.';

alter table public.email_settings enable row level security;

create policy email_settings_staff_read on public.email_settings
  for select to authenticated using (public.can_edit());
create policy email_settings_staff_write on public.email_settings
  for all to authenticated using (public.can_administer()) with check (public.can_administer());
