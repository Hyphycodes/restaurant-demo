-- Shared rate-limit counters for public route handlers.
--
-- Serverless instances share nothing in memory, so an in-process limiter is
-- only as good as the instance that happens to answer. This is a fixed-window
-- counter in the database. Callers FAIL OPEN if it is unreachable: a limiter
-- must never be the reason a real buyer cannot buy.
--
-- Rollback:
--   drop function if exists public.rate_limit_hit(text, int, int);
--   drop table if exists public.rate_limits;

create table if not exists public.rate_limits (
  key          text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);
comment on table public.rate_limits is
  'Fixed-window counters for public route handlers. Serverless instances share nothing in memory; this is where they share a count. Callers fail OPEN if it is unreachable.';

alter table public.rate_limits enable row level security;

-- True when the caller has exceeded p_limit hits inside a p_window_seconds window.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql volatile as $$
declare
  row_hits int;
begin
  insert into public.rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into row_hits;
  -- Opportunistic tidy-up so the table does not grow forever.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return row_hits > p_limit;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
