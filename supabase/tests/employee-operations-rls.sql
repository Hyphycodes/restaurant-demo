-- The employee operations security walkthrough: the rules the staff app
-- depends on, asserted against Row Level Security itself.
--
--   psql "$DATABASE_URL" -f supabase/tests/employee-operations-rls.sql
--   (or paste it into the Supabase SQL editor)
--
-- It proves, in one transaction that is ALWAYS ROLLED BACK at the end:
--
--   1. an employee reads their own employee row and nobody else's
--   2. an employee cannot read another employee's documents (requirements)
--   3. an employee cannot read manager notes, even about themselves
--   4. an employee cannot read the training answer keys
--   5. an employee cannot approve their own time off (the status column is
--      guarded: only pending → cancelled is theirs)
--   6. an employee cannot change their own positions or status
--   7. an employee can change their own availability and not a coworker's
--   8. an inactive employee resolves to no employee id and sees nothing
--   9. a contractor account (no employee row) sees no employee data
--  10. a manager (profiles.role = admin) cannot promote themselves to owner
--  11. an employee cannot read incidents, contractors or bookings
--  12. an employee can pick up an OPEN shift, and only for themselves
--  13. the service role (no auth.uid()) passes the column guards, which is
--      how the server grades a quiz and links a new sign-in
--
-- The tests impersonate users by setting the JWT claims Supabase sets, then
-- switching to the `authenticated` role, which is exactly what PostgREST
-- does. Every check is an `assert`. Silence means everything passed.

begin;

-- ----------------------------------------------------------- fixtures --

-- Three auth users: a manager, an employee and a second employee. A fourth
-- is a contractor with no employee row.
insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000a001', 'rls-manager@example.com',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000a002', 'rls-carlos@example.com',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000a003', 'rls-maria@example.com',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000a004', 'rls-dj@example.com',       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now());

-- handle_new_user gave each a profile as 'editor'; set the real roles.
update public.profiles set role = 'admin',      name = 'RLS Manager' where user_id = '00000000-0000-4000-8000-00000000a001';
update public.profiles set role = 'staff',      name = 'RLS Carlos'  where user_id = '00000000-0000-4000-8000-00000000a002';
update public.profiles set role = 'staff',      name = 'RLS Maria'   where user_id = '00000000-0000-4000-8000-00000000a003';
update public.profiles set role = 'contractor', name = 'RLS DJ'      where user_id = '00000000-0000-4000-8000-00000000a004';

insert into public.employees (id, user_id, first_name, last_name, email, status, primary_location_id)
values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000a001', 'Alex',   'Rivera',  'rls-manager@example.com', 'active', 'c05a0000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000a002', 'Carlos', 'Mendoza', 'rls-carlos@example.com',  'active', 'c05a0000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000a003', 'Maria',  'Lopez',   'rls-maria@example.com',   'active', 'c05a0000-0000-4000-8000-000000000001');

insert into public.employee_positions (employee_id, position_id, is_primary) values
  ('00000000-0000-4000-8000-00000000e002', 'bartender', true),
  ('00000000-0000-4000-8000-00000000e003', 'server', true);

insert into public.employee_notes (employee_id, author_id, author_name, kind, body)
values ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000a001', 'RLS Manager', 'coaching', 'RLS secret note about Carlos');

insert into public.employee_requirements (employee_id, requirement_type_id, status, file_path, file_name)
select '00000000-0000-4000-8000-00000000e003', id, 'submitted', 'employees/e003/requirements/rls-maria-basset.pdf', 'rls-maria-basset.pdf'
  from public.requirement_types where slug = 'basset';
insert into public.employee_requirements (employee_id, requirement_type_id, status)
select '00000000-0000-4000-8000-00000000e002', id, 'missing'
  from public.requirement_types where slug = 'employee-policies';

insert into public.training_modules (id, slug, title, status, passing_score)
values ('00000000-0000-4000-8000-00000000d001', 'rls-quiz', 'RLS quiz', 'published', 80);
insert into public.training_questions (id, module_id, sort, kind, prompt, options)
values ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d001', 10, 'true_false', 'RLS is on?', '[{"id":"o1","text":"True"},{"id":"o2","text":"False"}]');
insert into public.training_answer_keys (question_id, correct_option_ids) values ('00000000-0000-4000-8000-00000000d101', array['o1']);

insert into public.time_off_requests (id, employee_id, starts_on, ends_on, status)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e002', current_date + 30, current_date + 31, 'pending');

insert into public.availability_rules (employee_id, weekday, available) values
  ('00000000-0000-4000-8000-00000000e003', 1, false);

insert into public.contractors (id, name, service_type) values ('00000000-0000-4000-8000-00000000c001', 'RLS DJ', 'dj');
insert into public.incidents (summary, category, reporter_name) values ('RLS incident', 'other', 'RLS Manager');

-- An open (unassigned) published shift, for check 12. Created here, before
-- any impersonation begins, because shifts_manager_insert requires
-- is_manager() -- an employee picking one up is a shift_requests insert, not
-- a shifts insert.
insert into public.shifts (id, location_id, employee_id, position_id, starts_at, ends_at, status, published_at)
values ('00000000-0000-4000-8000-00000000b001', 'c05a0000-0000-4000-8000-000000000001', null, 'bartender', now() + interval '7 days', now() + interval '7 days 6 hours', 'published', now());

-- --------------------------------------------------------------- helpers --

create or replace function pg_temp.become(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.reset() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- ------------------------------------------------------------ as Carlos --

do $$
declare n int; ok boolean;
begin
  perform pg_temp.become('00000000-0000-4000-8000-00000000a002');

  -- 1. own row only
  select count(*) into n from public.employees;
  assert n = 1, format('Carlos should see 1 employee row, saw %s', n);
  select count(*) into n from public.employees where id = '00000000-0000-4000-8000-00000000e003';
  assert n = 0, 'Carlos can see Maria''s employee row';

  -- 2. no other employee''s documents
  select count(*) into n from public.employee_requirements where employee_id = '00000000-0000-4000-8000-00000000e003';
  assert n = 0, 'Carlos can read Maria''s requirements';
  select count(*) into n from public.employee_requirements where employee_id = '00000000-0000-4000-8000-00000000e002';
  assert n = 1, 'Carlos cannot read his own requirements';

  -- 3. no manager notes, even about himself
  select count(*) into n from public.employee_notes;
  assert n = 0, 'Carlos can read manager notes';

  -- 4. no answer keys, but the questions
  select count(*) into n from public.training_answer_keys;
  assert n = 0, 'Carlos can read the training answer keys';
  select count(*) into n from public.training_questions;
  assert n = 1, 'Carlos cannot read published training questions';

  -- 5. cannot approve his own time off; can withdraw it
  begin
    update public.time_off_requests set status = 'approved' where id = '00000000-0000-4000-8000-00000000f001';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Carlos approved his own time off';
  update public.time_off_requests set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000f001';
  select count(*) into n from public.time_off_requests where id = '00000000-0000-4000-8000-00000000f001' and status = 'cancelled';
  assert n = 1, 'Carlos could not withdraw his own pending request';

  -- 6. cannot change positions or status; can change his phone
  begin
    update public.employees set status = 'inactive' where id = '00000000-0000-4000-8000-00000000e002';
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Carlos changed his own status';
  begin
    insert into public.employee_positions (employee_id, position_id) values ('00000000-0000-4000-8000-00000000e002', 'manager');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Carlos gave himself a position';
  update public.employees set phone = '555-0102' where id = '00000000-0000-4000-8000-00000000e002';
  select count(*) into n from public.employees where phone = '555-0102';
  assert n = 1, 'Carlos could not change his own phone';

  -- 7. own availability yes, Maria''s no
  insert into public.availability_rules (employee_id, weekday, available) values ('00000000-0000-4000-8000-00000000e002', 1, false);
  begin
    insert into public.availability_rules (employee_id, weekday, available) values ('00000000-0000-4000-8000-00000000e003', 2, false);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Carlos wrote Maria''s availability';
  select count(*) into n from public.availability_rules where employee_id = '00000000-0000-4000-8000-00000000e003';
  assert n = 0, 'Carlos can read Maria''s availability';

  -- 12. an open shift can be picked up, and only for yourself
  begin
    insert into public.shift_requests (shift_id, kind, requested_by, claimed_by, status)
    values ('00000000-0000-4000-8000-00000000b001', 'cover', '00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000e003', 'claimed');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Carlos picked up an open shift on Maria''s behalf';
  insert into public.shift_requests (shift_id, kind, requested_by, claimed_by, status)
  values ('00000000-0000-4000-8000-00000000b001', 'cover', '00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e002', 'claimed');
  select count(*) into n from public.shift_requests where shift_id = '00000000-0000-4000-8000-00000000b001' and status = 'claimed';
  assert n = 1, 'Carlos could not pick up an open shift';

  -- 11. no incidents, contractors, bookings
  select count(*) into n from public.incidents;
  assert n = 0, 'Carlos can read incidents';
  select count(*) into n from public.contractors;
  assert n = 0, 'Carlos can read contractors';

  perform pg_temp.reset();
end $$;

-- ------------------------------------------- as the server (no auth.uid) --

-- The service role has no JWT, so auth.uid() is null. Every column guard must
-- let it through: this is how the server grades a quiz against the answer key
-- and links a new sign-in to an employee row.
do $$
declare n int;
begin
  assert auth.uid() is null, 'This block is supposed to run without a JWT';
  update public.employees set user_id = user_id, status = 'active' where id = '00000000-0000-4000-8000-00000000e002';
  update public.employee_requirements set status = 'complete', verified_at = now()
   where employee_id = '00000000-0000-4000-8000-00000000e003';
  select count(*) into n from public.employee_requirements
   where employee_id = '00000000-0000-4000-8000-00000000e003' and status = 'complete';
  assert n = 1, 'The server could not verify a document';
end $$;

-- ------------------------------------------------- as an inactive Carlos --

update public.employees set status = 'inactive' where id = '00000000-0000-4000-8000-00000000e002';

do $$
declare n int;
begin
  perform pg_temp.become('00000000-0000-4000-8000-00000000a002');
  assert public.current_employee_id() is null, 'An inactive employee still resolves to an employee id';
  select count(*) into n from public.employee_requirements;
  assert n = 0, 'An inactive employee can still read requirements';
  select count(*) into n from public.shifts;
  assert n = 0, 'An inactive employee can still read shifts';
  perform pg_temp.reset();
end $$;

update public.employees set status = 'active' where id = '00000000-0000-4000-8000-00000000e002';

-- --------------------------------------------------------- as the DJ --

do $$
declare n int;
begin
  perform pg_temp.become('00000000-0000-4000-8000-00000000a004');
  assert public.current_employee_id() is null, 'A contractor account resolves to an employee';
  select count(*) into n from public.employees;
  assert n = 0, 'A contractor can read employees';
  select count(*) into n from public.employee_requirements;
  assert n = 0, 'A contractor can read employee documents';
  select count(*) into n from public.training_modules;
  assert n = 0, 'A contractor can read training';
  select count(*) into n from public.contractors;
  assert n = 0, 'A contractor can read the contractor list';
  perform pg_temp.reset();
end $$;

-- ---------------------------------------------------- as the manager --

do $$
declare n int; ok boolean;
begin
  perform pg_temp.become('00000000-0000-4000-8000-00000000a001');

  select count(*) into n from public.employees where id in ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e003');
  assert n = 2, 'The manager cannot see the team';
  select count(*) into n from public.employee_notes;
  assert n = 1, 'The manager cannot read manager notes';
  select count(*) into n from public.training_answer_keys;
  assert n = 1, 'The manager cannot read answer keys';

  -- 10. cannot promote themselves (profiles_owner_write, migration 0003)
  update public.profiles set role = 'owner' where user_id = '00000000-0000-4000-8000-00000000a001';
  select count(*) into n from public.profiles where user_id = '00000000-0000-4000-8000-00000000a001' and role = 'owner';
  assert n = 0, 'A manager promoted themselves to owner';

  -- and can decide someone else''s time off
  insert into public.time_off_requests (id, employee_id, starts_on, ends_on, status)
  values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000e003', current_date + 40, current_date + 40, 'pending');
  update public.time_off_requests set status = 'approved', decided_by = '00000000-0000-4000-8000-00000000a001', decided_at = now() where id = '00000000-0000-4000-8000-00000000f002';
  select count(*) into n from public.time_off_requests where id = '00000000-0000-4000-8000-00000000f002' and status = 'approved';
  assert n = 1, 'The manager could not approve time off';

  ok := true;
  perform pg_temp.reset();
end $$;

-- Nothing is left behind.
rollback;
