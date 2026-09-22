-- Take four trigger functions out of the public API surface.
--
-- Supabase's linter flags nine SECURITY DEFINER functions as callable by `anon`
-- and `authenticated` through `/rest/v1/rpc/...`. Five of them have to stay:
-- `current_role`, `can_edit`, `can_administer`, `can_publish` and `is_owner` are
-- called BY the row-level policies, and a policy that calls a function the
-- caller may not execute fails for that caller — revoking those would lock every
-- editor out of their own admin. They read the caller's own role and nothing
-- else, so exposure costs nothing.
--
-- The other four are trigger functions. Nothing should ever call them directly,
-- and firing a trigger does NOT check the caller's EXECUTE privilege (that is
-- checked once, when the trigger is created), so revoking it changes no
-- behaviour at all — it only removes four endpoints that should never have been
-- reachable.
--
-- Rollback:
--   grant execute on function public.record_audit(), public.guard_publish(),
--     public.guard_insert(), public.handle_new_user() to anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array['record_audit', 'guard_publish', 'guard_insert', 'handle_new_user']
  loop
    -- Signature-agnostic: each of these takes no arguments today, but a revoke
    -- that names the wrong signature silently does nothing, which is exactly
    -- the failure this migration exists to avoid.
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = fn) then
      execute format('revoke execute on function public.%I() from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;

comment on function public.record_audit() is
  'Trigger only. Revoked from anon and authenticated in 0016: a trigger fires without checking the caller''s EXECUTE privilege, so this costs nothing and removes an endpoint.';
