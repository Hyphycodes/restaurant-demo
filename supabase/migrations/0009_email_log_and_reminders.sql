-- Ticket delivery bookkeeping.
--
--   email_log            every ticket email attempted, with the provider id and
--                        any error, so "I never got my ticket" is answerable in
--                        five seconds from the admin.
--   reminder_sent_at     on orders, set once the 24-hour reminder went out.
--   checked_in_override  on tickets: staff let someone in on a duplicate scan.
--
-- Rollback:
--   alter table public.tickets drop column if exists checked_in_override;
--   alter table public.orders drop column if exists reminder_sent_at;
--   drop table if exists public.email_log;

create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders (id) on delete cascade,
  type         text not null check (type in ('confirmation', 'reminder', 'resend', 'owner_alert', 'cancellation')),
  to_email     text,
  provider_id  text,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists email_log_order_idx on public.email_log (order_id, created_at desc);
comment on table public.email_log is
  'Every ticket email attempted, with the provider id and any error, so "I never got my ticket" is answerable in five seconds.';
-- No public policies: staff read it through server code.
alter table public.email_log enable row level security;

alter table public.orders add column if not exists reminder_sent_at timestamptz;
comment on column public.orders.reminder_sent_at is 'Set once the 24-hour reminder went out, so it never goes twice.';

alter table public.tickets add column if not exists checked_in_override boolean not null default false;
