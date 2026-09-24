-- Casa Aurelia employee operations: locations, employees, requirements, training,
-- scheduling, availability, time off, coverage, tasks, checklists, event
-- staffing, contractors, announcements, notifications, incidents, notes.
--
-- The shape, and why:
--
--   IDENTITY IS NOT DUPLICATED. An employee row points at the auth user it
--   belongs to (employees.user_id), and profiles.role keeps deciding what the
--   account may do in the admin. A Manager is profiles.role = 'admin' with an
--   employee row; a bartender is profiles.role = 'staff' with one. A row with
--   no user is a person who has been added but has not signed in yet.
--
--   ONE REQUIREMENTS PRIMITIVE. Documents, policies, certifications and the
--   onboarding checklist are all a `requirement_types` row and, per employee, an
--   `employee_requirements` row. What differs is the `kind` (acknowledge, upload,
--   link, manager verification) and whether it expires. Nothing legal is
--   invented here: the rows are what management configures.
--
--   ONE LOCATION MODEL. `locations` exists from this migration and Chicago is
--   its first row. Events, shifts, tasks, incidents and announcements can
--   belong to a location. Existing event rows are backfilled to Chicago, and
--   every location column is nullable so nothing that inserts an event today
--   has to change.
--
--   RLS IS THE BOUNDARY. `current_employee_id()` resolves the caller to their
--   own employee row (null when inactive), `is_manager()` is Owner or Manager.
--   Every table below has policies; the ones an employee may write to have a
--   BEFORE trigger limiting which columns they may change, so a direct
--   PostgREST call cannot do what the screen does not offer.
--
-- Rollback (reverse order of creation): drop the tables listed at the bottom
-- of this file, drop the three helper functions, drop the location columns
-- from event_series and event_occurrences, and delete the 'employee-files'
-- bucket. Nothing here alters an existing column.

-- ------------------------------------------------------------ helpers -------

-- current_employee_id() is `language sql`, and Postgres validates a SQL
-- function's body at CREATE time by planning it against the catalog as it
-- stands right then -- which is before `employees` exists further down this
-- same file. `local` keeps this scoped to the migration's own transaction.
set local check_function_bodies = off;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'admin');
$$;

comment on function public.is_manager is
  'Owner or Manager. The operational management tier; the same pair can_publish() names for content.';

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
    from public.employees e
   where e.user_id = auth.uid()
     and e.archived_at is null
     and e.status in ('invited', 'active', 'on_leave')
   limit 1;
$$;

comment on function public.current_employee_id is
  'The caller''s own employee row, or null. Null for an inactive or archived employee, which is what keeps them out of every staff table at once.';

create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_employee_id() is not null;
$$;

-- ---------------------------------------------------------- locations -------

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null check (length(trim(name)) > 0),
  short_name  text,
  street      text,
  locality    text,
  region      text,
  postal_code text,
  timezone    text not null default 'America/Chicago',
  phone       text,
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.locations is
  'Every place Casa Aurelia operates. Chicago is the first row; River North is a second row, not a fork of the code.';

insert into public.locations (id, slug, name, short_name, street, locality, region, postal_code, timezone, phone, sort)
values ('c05a0000-0000-4000-8000-000000000001', 'chicago', 'Casa Aurelia Chicago', 'Chicago',
        'West Loop', 'Chicago', 'IL', '', 'America/Chicago', '(312) 555-0147', 0)
on conflict (slug) do nothing;

alter table public.event_series
  add column if not exists location_id uuid references public.locations (id) on delete set null;
alter table public.event_occurrences
  add column if not exists location_id uuid references public.locations (id) on delete set null;

-- event_series_guard_publish / event_occurrences_guard_publish (0003) block a
-- change to a published row's live columns unless the acting role reads as
-- owner/admin via can_publish() -- which resolves through auth.uid() and so
-- has no one to check against in a migration session. Same precedent as the
-- backfill in 0013: switched off for these two backfill statements only.
alter table public.event_series disable trigger event_series_guard_publish;
alter table public.event_occurrences disable trigger event_occurrences_guard_publish;

update public.event_series      set location_id = 'c05a0000-0000-4000-8000-000000000001' where location_id is null;
update public.event_occurrences set location_id = 'c05a0000-0000-4000-8000-000000000001' where location_id is null;

alter table public.event_series enable trigger event_series_guard_publish;
alter table public.event_occurrences enable trigger event_occurrences_guard_publish;

comment on column public.event_occurrences.location_id is
  'Where the night happens. Null reads as the default location (Chicago) so nothing that inserted events before 0022 breaks.';

create index if not exists event_occurrences_location_idx on public.event_occurrences (location_id, starts_at);

-- ---------------------------------------------------------- positions -------

create table if not exists public.positions (
  id         text primary key check (id ~ '^[a-z0-9_]+$'),
  name       text not null,
  department text not null default 'front' check (department in ('front', 'bar', 'kitchen', 'door', 'events', 'management', 'other')),
  sort       integer not null default 0,
  active     boolean not null default true
);

insert into public.positions (id, name, department, sort) values
  ('manager',        'Manager',          'management', 0),
  ('server',         'Server',           'front',      10),
  ('bartender',      'Bartender',        'bar',        20),
  ('host',           'Host',             'front',      30),
  ('busser',         'Busser',           'front',      40),
  ('door',           'Door',             'door',       50),
  ('security',       'Security',         'door',       60),
  ('dj',             'DJ',               'events',     70),
  ('event_staff',    'Event staff',      'events',     80),
  ('kitchen',        'Kitchen',          'kitchen',    90),
  ('content_social', 'Content & social', 'other',      100)
on conflict (id) do nothing;

-- ---------------------------------------------------------- employees -------

create table if not exists public.employees (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users (id) on delete set null,
  first_name            text not null check (length(trim(first_name)) > 0),
  last_name             text not null default '',
  preferred_name        text,
  email                 text not null check (position('@' in email) > 1),
  phone                 text,
  status                text not null default 'invited'
                        check (status in ('invited', 'active', 'on_leave', 'inactive')),
  employment_type       text not null default 'part_time'
                        check (employment_type in ('full_time', 'part_time', 'seasonal', 'on_call')),
  primary_location_id   uuid references public.locations (id) on delete set null,
  manager_employee_id   uuid references public.employees (id) on delete set null,
  hire_date             date,
  start_date            date,
  end_date              date,
  emergency_contact_name         text,
  emergency_contact_phone        text,
  emergency_contact_relationship text,
  shirt_size            text,
  preferred_language    text not null default 'en' check (preferred_language in ('en', 'es')),
  birthday_month        integer check (birthday_month is null or birthday_month between 1 and 12),
  birthday_day          integer check (birthday_day is null or birthday_day between 1 and 31),
  photo_path            text,
  notification_email    boolean not null default true,
  onboarding_completed_at timestamptz,
  first_shift_confirmed_at timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);

create unique index if not exists employees_email_idx on public.employees (lower(email)) where archived_at is null;
create index if not exists employees_status_idx on public.employees (status) where archived_at is null;
create index if not exists employees_location_idx on public.employees (primary_location_id);

comment on table public.employees is
  'One row per person who works at Casa Aurelia. user_id links the sign-in; profiles.role says what the account may do. Contractors are a separate table.';
comment on column public.employees.photo_path is
  'Object path in the private employee-files bucket. Served through a signed URL, never a public one.';

create table if not exists public.employee_positions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  position_id text not null references public.positions (id) on delete cascade,
  is_primary  boolean not null default false,
  since       date,
  unique (employee_id, position_id)
);

create table if not exists public.employee_locations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  unique (employee_id, location_id)
);

create table if not exists public.employee_notes (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  kind        text not null default 'other'
              check (kind in ('coaching', 'attendance', 'recognition', 'follow_up', 'other')),
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists employee_notes_employee_idx on public.employee_notes (employee_id, created_at desc);
comment on table public.employee_notes is
  'Manager-only. No policy grants an employee any access to this table, including to notes about themselves.';

-- ------------------------------------------------------- requirements -------

create table if not exists public.requirement_types (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  title                text not null check (length(trim(title)) > 0),
  description          text,
  category             text not null default 'document'
                       check (category in ('employment', 'policy', 'handbook', 'certification', 'safety', 'uniform', 'confidentiality', 'payroll', 'training', 'profile', 'other')),
  kind                 text not null default 'acknowledgement'
                       check (kind in ('acknowledgement', 'upload', 'link', 'manager_verify', 'training_module', 'system')),
  system_key           text check (system_key is null or system_key in ('personal_details', 'emergency_contact', 'availability', 'positions', 'location', 'first_shift')),
  training_module_id   uuid,
  external_url         text,
  required             boolean not null default true,
  onboarding           boolean not null default false,
  applies_to_positions text[] not null default '{}',
  applies_to_locations uuid[] not null default '{}',
  expires_after_days   integer check (expires_after_days is null or expires_after_days > 0),
  sort                 integer not null default 0,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  archived_at          timestamptz,
  constraint requirement_types_system_kind check ((kind = 'system') = (system_key is not null))
);

comment on table public.requirement_types is
  'What management asks of an employee: a policy to acknowledge, a certificate to upload, a form to complete on an outside site, a step a manager verifies. Empty applies_to arrays mean everyone.';

create table if not exists public.employee_requirements (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees (id) on delete cascade,
  requirement_type_id uuid not null references public.requirement_types (id) on delete cascade,
  status              text not null default 'missing'
                      check (status in ('missing', 'submitted', 'complete', 'expired', 'waived')),
  file_path           text,
  file_name           text,
  credential_number   text,
  issued_on           date,
  expires_on          date,
  acknowledged_at     timestamptz,
  submitted_at        timestamptz,
  verified_by         uuid references auth.users (id) on delete set null,
  verified_at         timestamptz,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (employee_id, requirement_type_id)
);
create index if not exists employee_requirements_expiry_idx on public.employee_requirements (expires_on) where expires_on is not null;
create index if not exists employee_requirements_status_idx on public.employee_requirements (status);

-- ----------------------------------------------------------- training -------

create table if not exists public.training_modules (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title                text not null check (length(trim(title)) > 0),
  description          text,
  category             text not null default 'general'
                       check (category in ('general', 'guest_experience', 'operations', 'bar', 'door', 'events', 'kitchen', 'safety', 'policy')),
  estimated_minutes    integer check (estimated_minutes is null or estimated_minutes > 0),
  required             boolean not null default false,
  applies_to_positions text[] not null default '{}',
  applies_to_locations uuid[] not null default '{}',
  passing_score        integer check (passing_score is null or passing_score between 1 and 100),
  retrain_interval_days integer check (retrain_interval_days is null or retrain_interval_days > 0),
  version              integer not null default 1 check (version >= 1),
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  archived_at          timestamptz
);

alter table public.requirement_types
  drop constraint if exists requirement_types_training_module_fk;
alter table public.requirement_types
  add constraint requirement_types_training_module_fk
  foreign key (training_module_id) references public.training_modules (id) on delete set null;

create table if not exists public.training_sections (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.training_modules (id) on delete cascade,
  sort       integer not null default 0,
  kind       text not null default 'text' check (kind in ('text', 'video', 'image', 'checklist', 'link')),
  title      text not null default '',
  body       text,
  media_url  text,
  -- Only for kind = 'checklist': the lines the employee ticks through.
  items      text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists training_sections_module_idx on public.training_sections (module_id, sort);

create table if not exists public.training_questions (
  id        uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules (id) on delete cascade,
  sort      integer not null default 0,
  kind      text not null default 'multiple_choice' check (kind in ('multiple_choice', 'true_false', 'multi_select')),
  prompt    text not null check (length(trim(prompt)) > 0),
  -- Ordered options the employee chooses from. The correct ones live in
  -- training_answer_keys, which no employee policy can read.
  options   jsonb not null default '[]'::jsonb
);
create index if not exists training_questions_module_idx on public.training_questions (module_id, sort);

create table if not exists public.training_answer_keys (
  question_id        uuid primary key references public.training_questions (id) on delete cascade,
  correct_option_ids text[] not null default '{}',
  explanation        text
);
comment on table public.training_answer_keys is
  'Manager-only. Grading runs server-side, so an employee''s browser never receives the answers before submission.';

create table if not exists public.training_assignments (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.training_modules (id) on delete cascade,
  employee_id       uuid not null references public.employees (id) on delete cascade,
  assigned_by       uuid references auth.users (id) on delete set null,
  assigned_at       timestamptz not null default now(),
  due_on            date,
  status            text not null default 'assigned'
                    check (status in ('assigned', 'in_progress', 'completed', 'expired')),
  started_at        timestamptz,
  completed_at      timestamptz,
  expires_at        timestamptz,
  completed_version integer,
  score             integer check (score is null or score between 0 and 100),
  attempts          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (module_id, employee_id)
);
create index if not exists training_assignments_employee_idx on public.training_assignments (employee_id, status);

create table if not exists public.training_attempts (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  module_id     uuid not null references public.training_modules (id) on delete cascade,
  version       integer not null,
  answers       jsonb not null default '{}'::jsonb,
  score         integer not null check (score between 0 and 100),
  passed        boolean not null,
  submitted_at  timestamptz not null default now()
);
create index if not exists training_attempts_assignment_idx on public.training_attempts (assignment_id, submitted_at desc);

-- --------------------------------------------------------- scheduling -------

create table if not exists public.shifts (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references public.locations (id) on delete restrict,
  employee_id       uuid references public.employees (id) on delete set null,
  position_id       text not null references public.positions (id) on delete restrict,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  event_id          text references public.event_occurrences (id) on delete set null,
  note              text,
  status            text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  published_at      timestamptz,
  repeat_group_id   uuid,
  -- Attendance. Optional; 'not_tracked' is the honest default.
  clock_in_at       timestamptz,
  clock_out_at      timestamptz,
  break_minutes     integer not null default 0 check (break_minutes >= 0),
  attendance_status text not null default 'not_tracked'
                    check (attendance_status in ('not_tracked', 'on_time', 'late', 'absent', 'left_early', 'excused')),
  attendance_note   text,
  corrected_by      uuid references auth.users (id) on delete set null,
  corrected_at      timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  constraint shifts_duration check (ends_at > starts_at),
  constraint shifts_clock_order check (clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at)
);
create index if not exists shifts_employee_idx on public.shifts (employee_id, starts_at) where archived_at is null;
create index if not exists shifts_location_idx on public.shifts (location_id, starts_at) where archived_at is null;
create index if not exists shifts_event_idx on public.shifts (event_id) where event_id is not null;
create index if not exists shifts_open_idx on public.shifts (starts_at) where employee_id is null and archived_at is null;

comment on column public.shifts.employee_id is 'Null is an open shift: published for anyone eligible to pick up.';
comment on column public.shifts.repeat_group_id is 'Shifts created together as a repeat share a group id, so "this and following" edits are possible later.';

create table if not exists public.shift_history (
  id         bigserial primary key,
  shift_id   uuid not null references public.shifts (id) on delete cascade,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  reason     text not null default '',
  before     jsonb,
  after      jsonb
);
create index if not exists shift_history_shift_idx on public.shift_history (shift_id, changed_at desc);

create table if not exists public.availability_rules (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  weekday       integer not null check (weekday between 0 and 6),
  available     boolean not null default true,
  start_minutes integer check (start_minutes is null or start_minutes between 0 and 1440),
  end_minutes   integer check (end_minutes is null or end_minutes between 0 and 1440),
  note          text,
  updated_at    timestamptz not null default now(),
  unique (employee_id, weekday),
  constraint availability_rules_window check (start_minutes is null or end_minutes is null or end_minutes > start_minutes)
);

create table if not exists public.availability_exceptions (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  on_date       date not null,
  available     boolean not null default false,
  start_minutes integer check (start_minutes is null or start_minutes between 0 and 1440),
  end_minutes   integer check (end_minutes is null or end_minutes between 0 and 1440),
  note          text,
  created_at    timestamptz not null default now(),
  unique (employee_id, on_date)
);

create table if not exists public.time_off_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  reason        text,
  note          text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_off_range check (ends_on >= starts_on)
);
create index if not exists time_off_requests_employee_idx on public.time_off_requests (employee_id, starts_on desc);
create index if not exists time_off_requests_pending_idx on public.time_off_requests (status, starts_on) where status = 'pending';

create table if not exists public.shift_requests (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references public.shifts (id) on delete cascade,
  kind          text not null check (kind in ('give_up', 'swap', 'cover')),
  requested_by  uuid not null references public.employees (id) on delete cascade,
  swap_shift_id uuid references public.shifts (id) on delete set null,
  claimed_by    uuid references public.employees (id) on delete set null,
  claimed_at    timestamptz,
  status        text not null default 'open' check (status in ('open', 'claimed', 'approved', 'denied', 'cancelled')),
  note          text,
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shift_requests_shift_idx on public.shift_requests (shift_id);
create index if not exists shift_requests_open_idx on public.shift_requests (status, created_at desc) where status in ('open', 'claimed');

-- ------------------------------------------------------ tasks & lists -------

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  description  text,
  assigned_to  uuid references public.employees (id) on delete set null,
  assigned_by  uuid references auth.users (id) on delete set null,
  location_id  uuid references public.locations (id) on delete set null,
  event_id     text references public.event_occurrences (id) on delete set null,
  due_at       timestamptz,
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);
create index if not exists tasks_assignee_idx on public.tasks (assigned_to, status) where archived_at is null;
create index if not exists tasks_due_idx on public.tasks (due_at) where archived_at is null and status <> 'done';
create index if not exists tasks_event_idx on public.tasks (event_id) where event_id is not null;

create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  description text,
  kind        text not null default 'other' check (kind in ('opening', 'closing', 'bar', 'event', 'door', 'kitchen', 'cleaning', 'other')),
  location_id uuid references public.locations (id) on delete set null,
  position_id text references public.positions (id) on delete set null,
  active      boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.checklist_template_items (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.checklist_templates (id) on delete cascade,
  sort           integer not null default 0,
  label          text not null check (length(trim(label)) > 0),
  requires_photo boolean not null default false,
  requires_note  boolean not null default false
);
create index if not exists checklist_template_items_idx on public.checklist_template_items (template_id, sort);

create table if not exists public.checklist_runs (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references public.checklist_templates (id) on delete restrict,
  title                text not null,
  on_date              date not null,
  location_id          uuid references public.locations (id) on delete set null,
  event_id             text references public.event_occurrences (id) on delete set null,
  shift_id             uuid references public.shifts (id) on delete set null,
  position_id          text references public.positions (id) on delete set null,
  assigned_employee_id uuid references public.employees (id) on delete set null,
  status               text not null default 'open' check (status in ('open', 'complete', 'verified')),
  started_at           timestamptz,
  completed_at         timestamptz,
  verified_by          uuid references auth.users (id) on delete set null,
  verified_at          timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists checklist_runs_date_idx on public.checklist_runs (on_date desc, location_id);
create index if not exists checklist_runs_employee_idx on public.checklist_runs (assigned_employee_id, on_date desc);

create table if not exists public.checklist_run_items (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.checklist_runs (id) on delete cascade,
  sort         integer not null default 0,
  label        text not null,
  requires_photo boolean not null default false,
  requires_note  boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.employees (id) on delete set null,
  note         text,
  photo_path   text
);
create index if not exists checklist_run_items_run_idx on public.checklist_run_items (run_id, sort);

-- ------------------------------------------------- staffing & contractors ---

create table if not exists public.contractors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 0),
  company_name        text,
  phone               text,
  email               text,
  service_type        text not null default 'other'
                      check (service_type in ('dj', 'instructor', 'painter', 'band', 'performer', 'photographer', 'security', 'other')),
  default_rate_cents  integer check (default_rate_cents is null or default_rate_cents >= 0),
  payment_method_note text,
  w9_status           text not null default 'missing' check (w9_status in ('missing', 'requested', 'received')),
  notes               text,
  user_id             uuid references auth.users (id) on delete set null,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz
);

create table if not exists public.contractor_bookings (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references public.contractors (id) on delete cascade,
  event_id       text references public.event_occurrences (id) on delete set null,
  location_id    uuid references public.locations (id) on delete set null,
  role           text not null default 'other'
                 check (role in ('dj', 'instructor', 'painter', 'band', 'performer', 'photographer', 'security', 'other')),
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         text not null default 'tentative' check (status in ('tentative', 'confirmed', 'cancelled', 'completed')),
  agreed_cents   integer not null default 0 check (agreed_cents >= 0),
  deposit_cents  integer not null default 0 check (deposit_cents >= 0),
  paid_cents     integer not null default 0 check (paid_cents >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_paid', 'paid')),
  payment_note   text,
  paid_on        date,
  note           text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists contractor_bookings_event_idx on public.contractor_bookings (event_id);
create index if not exists contractor_bookings_contractor_idx on public.contractor_bookings (contractor_id, starts_at desc);

create table if not exists public.event_assignments (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.event_occurrences (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  role        text not null default 'other'
              check (role in ('event_manager', 'dj', 'door', 'security', 'bartender', 'server', 'host', 'instructor', 'photographer', 'other')),
  shift_id    uuid references public.shifts (id) on delete set null,
  starts_at   timestamptz,
  ends_at     timestamptz,
  note        text,
  status      text not null default 'planned' check (status in ('planned', 'confirmed', 'cancelled')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, employee_id, role)
);
create index if not exists event_assignments_event_idx on public.event_assignments (event_id);
create index if not exists event_assignments_employee_idx on public.event_assignments (employee_id);

-- ---------------------------------------- announcements & notifications -----

create table if not exists public.staff_announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  body         text not null default '',
  kind         text not null default 'general' check (kind in ('general', 'urgent')),
  location_id  uuid references public.locations (id) on delete set null,
  positions    text[] not null default '{}',
  event_id     text references public.event_occurrences (id) on delete set null,
  requires_ack boolean not null default false,
  published_at timestamptz,
  expires_at   timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  author_name  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);
create index if not exists staff_announcements_live_idx on public.staff_announcements (published_at desc) where archived_at is null;

create table if not exists public.staff_announcement_reads (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.staff_announcements (id) on delete cascade,
  employee_id     uuid not null references public.employees (id) on delete cascade,
  read_at         timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (announcement_id, employee_id)
);

create table if not exists public.staff_notifications (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  href        text,
  entity_type text,
  entity_id   text,
  emailed_at  timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists staff_notifications_employee_idx on public.staff_notifications (employee_id, created_at desc);
create index if not exists staff_notifications_unread_idx on public.staff_notifications (employee_id) where read_at is null;

create table if not exists public.ops_comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'time_off_request', 'shift_request', 'incident', 'event_staffing', 'shift', 'checklist_run')),
  entity_id   text not null,
  author_id   uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index if not exists ops_comments_entity_idx on public.ops_comments (entity_type, entity_id, created_at);

-- ---------------------------------------------------------- incidents -------

create table if not exists public.incidents (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  location_id      uuid references public.locations (id) on delete set null,
  event_id         text references public.event_occurrences (id) on delete set null,
  category         text not null default 'other'
                   check (category in ('guest', 'injury', 'security', 'equipment', 'payment', 'alcohol', 'other')),
  summary          text not null check (length(trim(summary)) > 0),
  description      text,
  actions_taken    text,
  attachment_paths text[] not null default '{}',
  follow_up_status text not null default 'open' check (follow_up_status in ('open', 'monitoring', 'closed')),
  reported_by      uuid references auth.users (id) on delete set null,
  reporter_name    text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);
create index if not exists incidents_occurred_idx on public.incidents (occurred_at desc) where archived_at is null;

create table if not exists public.incident_employees (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  involvement text not null default 'involved' check (involvement in ('involved', 'witness', 'responded')),
  unique (incident_id, employee_id)
);

-- -------------------------------------------------------------- audit -------

create table if not exists public.ops_audit_log (
  id          bigserial primary key,
  actor       uuid references auth.users (id) on delete set null,
  actor_name  text not null default '',
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);
create index if not exists ops_audit_log_at_idx on public.ops_audit_log (at desc);
create index if not exists ops_audit_log_entity_idx on public.ops_audit_log (entity_type, entity_id, at desc);
comment on table public.ops_audit_log is
  'Management actions on staff data: who, what, before and after. Written by server code only; readable by managers. Never holds a secret or a file.';

-- --------------------------------------------------------- touch triggers ---

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations', 'employees', 'requirement_types', 'employee_requirements', 'training_modules',
    'training_assignments', 'shifts', 'time_off_requests', 'shift_requests', 'tasks',
    'checklist_templates', 'checklist_runs', 'contractors', 'contractor_bookings',
    'event_assignments', 'staff_announcements', 'incidents', 'availability_rules'
  ]
  loop
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------- employee write guards ----

-- The columns an employee may change on their own row. Everything else on the
-- row is management's: status, positions, hire date, manager, notes.
create or replace function public.guard_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array[
    'preferred_name', 'phone', 'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relationship', 'shirt_size', 'preferred_language', 'birthday_month',
    'birthday_day', 'photo_path', 'notification_email', 'updated_at'
  ];
  before_locked jsonb;
  after_locked  jsonb;
  col text;
begin
  -- The service role has no auth.uid(). That is the server acting after its
  -- own capability check — grading a quiz against the answer key, linking a
  -- new sign-in, fanning out notifications — and it already bypasses RLS
  -- entirely, so refusing it here protects nothing and breaks those writes.
  -- These guards exist to constrain an AUTHENTICATED EMPLOYEE, and an
  -- anonymous caller never reaches them: no policy on any of these tables
  -- grants `anon` a row in the first place.
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;
  if old.id is distinct from public.current_employee_id() then
    raise exception 'You can only change your own profile.' using errcode = '42501';
  end if;
  before_locked := to_jsonb(old);
  after_locked  := to_jsonb(new);
  foreach col in array allowed loop
    before_locked := before_locked - col;
    after_locked  := after_locked - col;
  end loop;
  if before_locked is distinct from after_locked then
    raise exception 'Only a manager can change that part of a profile.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_guard_self_update on public.employees;
create trigger employees_guard_self_update before update on public.employees
  for each row execute function public.guard_employee_self_update();

-- Generic guard: for a non-manager, only the named columns may change, and the
-- row has to be theirs (the caller passes which column names the owner).
create or replace function public.guard_employee_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_column text := tg_argv[0];
  allowed text[] := string_to_array(tg_argv[1], ',');
  before_locked jsonb;
  after_locked  jsonb;
  col text;
begin
  -- The service role has no auth.uid(). That is the server acting after its
  -- own capability check — grading a quiz against the answer key, linking a
  -- new sign-in, fanning out notifications — and it already bypasses RLS
  -- entirely, so refusing it here protects nothing and breaks those writes.
  -- These guards exist to constrain an AUTHENTICATED EMPLOYEE, and an
  -- anonymous caller never reaches them: no policy on any of these tables
  -- grants `anon` a row in the first place.
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;
  if (to_jsonb(old) ->> owner_column) is distinct from public.current_employee_id()::text then
    raise exception 'That is not yours to change.' using errcode = '42501';
  end if;
  before_locked := to_jsonb(old);
  after_locked  := to_jsonb(new);
  foreach col in array allowed loop
    before_locked := before_locked - col;
    after_locked  := after_locked - col;
  end loop;
  if before_locked is distinct from after_locked then
    raise exception 'Only a manager can change that.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Time off: an employee may only withdraw a pending request.
create or replace function public.guard_time_off_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role has no auth.uid(). That is the server acting after its
  -- own capability check — grading a quiz against the answer key, linking a
  -- new sign-in, fanning out notifications — and it already bypasses RLS
  -- entirely, so refusing it here protects nothing and breaks those writes.
  -- These guards exist to constrain an AUTHENTICATED EMPLOYEE, and an
  -- anonymous caller never reaches them: no policy on any of these tables
  -- grants `anon` a row in the first place.
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.employee_id is distinct from public.current_employee_id() then
      raise exception 'You can only request time off for yourself.' using errcode = '42501';
    end if;
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := null;
    return new;
  end if;
  if old.employee_id is distinct from public.current_employee_id() then
    raise exception 'That request is not yours.' using errcode = '42501';
  end if;
  if not (old.status = 'pending' and new.status = 'cancelled') then
    raise exception 'A manager decides time off. You can only withdraw a pending request.' using errcode = '42501';
  end if;
  if (to_jsonb(old) - 'status' - 'updated_at') is distinct from (to_jsonb(new) - 'status' - 'updated_at') then
    raise exception 'Only the status can change on a submitted request.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists time_off_requests_guard on public.time_off_requests;
create trigger time_off_requests_guard before insert or update on public.time_off_requests
  for each row execute function public.guard_time_off_employee();

-- Coverage: an employee may open a request on their own shift, claim an open
-- one, or withdraw their own. Approval is a manager's.
create or replace function public.guard_shift_request_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_employee_id();
  owner uuid;
begin
  -- The service role has no auth.uid(). That is the server acting after its
  -- own capability check — grading a quiz against the answer key, linking a
  -- new sign-in, fanning out notifications — and it already bypasses RLS
  -- entirely, so refusing it here protects nothing and breaks those writes.
  -- These guards exist to constrain an AUTHENTICATED EMPLOYEE, and an
  -- anonymous caller never reaches them: no policy on any of these tables
  -- grants `anon` a row in the first place.
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select employee_id into owner from public.shifts where id = new.shift_id;
    -- An OPEN shift has no owner to give it up. Asking for one is a claim on
    -- your own behalf, and a manager still approves it.
    if owner is null then
      if new.requested_by is distinct from me or new.claimed_by is distinct from me then
        raise exception 'You can only pick up an open shift for yourself.' using errcode = '42501';
      end if;
      new.status := 'claimed';
      new.decided_by := null;
      new.decided_at := null;
      return new;
    end if;
    if owner is distinct from me or new.requested_by is distinct from me then
      raise exception 'You can only offer your own shift.' using errcode = '42501';
    end if;
    new.status := 'open';
    new.claimed_by := null;
    new.claimed_at := null;
    new.decided_by := null;
    new.decided_at := null;
    return new;
  end if;
  -- Withdraw your own.
  if old.requested_by = me and old.status in ('open', 'claimed') and new.status = 'cancelled'
     and (to_jsonb(old) - 'status' - 'updated_at') is not distinct from (to_jsonb(new) - 'status' - 'updated_at') then
    return new;
  end if;
  -- Claim an open one that is not yours.
  if old.status = 'open' and old.requested_by <> me and new.status = 'claimed' and new.claimed_by = me
     and (to_jsonb(old) - 'status' - 'claimed_by' - 'claimed_at' - 'updated_at')
         is not distinct from (to_jsonb(new) - 'status' - 'claimed_by' - 'claimed_at' - 'updated_at') then
    return new;
  end if;
  raise exception 'A manager approves shift changes.' using errcode = '42501';
end;
$$;

drop trigger if exists shift_requests_guard on public.shift_requests;
create trigger shift_requests_guard before insert or update on public.shift_requests
  for each row execute function public.guard_shift_request_employee();

-- Requirements: an employee may acknowledge, upload and fill in dates on their
-- own row; verifying and waiving are a manager's.
create or replace function public.guard_requirement_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rt_kind text;
begin
  -- The service role has no auth.uid(). That is the server acting after its
  -- own capability check — grading a quiz against the answer key, linking a
  -- new sign-in, fanning out notifications — and it already bypasses RLS
  -- entirely, so refusing it here protects nothing and breaks those writes.
  -- These guards exist to constrain an AUTHENTICATED EMPLOYEE, and an
  -- anonymous caller never reaches them: no policy on any of these tables
  -- grants `anon` a row in the first place.
  if auth.uid() is null or public.is_manager() then
    return new;
  end if;
  if old.employee_id is distinct from public.current_employee_id() then
    raise exception 'That is not yours to change.' using errcode = '42501';
  end if;
  select kind into rt_kind from public.requirement_types where id = old.requirement_type_id;
  if (to_jsonb(old) - 'status' - 'file_path' - 'file_name' - 'credential_number' - 'issued_on' - 'expires_on' - 'acknowledged_at' - 'submitted_at' - 'updated_at')
     is distinct from
     (to_jsonb(new) - 'status' - 'file_path' - 'file_name' - 'credential_number' - 'issued_on' - 'expires_on' - 'acknowledged_at' - 'submitted_at' - 'updated_at') then
    raise exception 'Only a manager can verify or waive a requirement.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if rt_kind in ('acknowledgement', 'link') and new.status = 'complete' then
      return new;
    end if;
    if new.status = 'submitted' then
      return new;
    end if;
    raise exception 'A manager has to verify that.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists employee_requirements_guard on public.employee_requirements;
create trigger employee_requirements_guard before update on public.employee_requirements
  for each row execute function public.guard_requirement_employee();

drop trigger if exists shifts_guard_employee on public.shifts;
create trigger shifts_guard_employee before update on public.shifts
  for each row execute function public.guard_employee_columns('employee_id', 'clock_in_at,clock_out_at,break_minutes,updated_at');

drop trigger if exists tasks_guard_employee on public.tasks;
create trigger tasks_guard_employee before update on public.tasks
  for each row execute function public.guard_employee_columns('assigned_to', 'status,completed_at,updated_at');

drop trigger if exists training_assignments_guard_employee on public.training_assignments;
create trigger training_assignments_guard_employee before update on public.training_assignments
  for each row execute function public.guard_employee_columns('employee_id', 'started_at,status,updated_at');

drop trigger if exists staff_notifications_guard_employee on public.staff_notifications;
create trigger staff_notifications_guard_employee before update on public.staff_notifications
  for each row execute function public.guard_employee_columns('employee_id', 'read_at');

-- Trigger functions are not an API.
do $$
declare
  fn text;
begin
  foreach fn in array array['guard_employee_self_update', 'guard_employee_columns', 'guard_time_off_employee', 'guard_shift_request_employee', 'guard_requirement_employee']
  loop
    execute format('revoke execute on function public.%I() from public, anon, authenticated', fn);
  end loop;
end $$;

-- ------------------------------------------------------------------ RLS -----

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations', 'positions', 'employees', 'employee_positions', 'employee_locations', 'employee_notes',
    'requirement_types', 'employee_requirements', 'training_modules', 'training_sections',
    'training_questions', 'training_answer_keys', 'training_assignments', 'training_attempts',
    'shifts', 'shift_history', 'availability_rules', 'availability_exceptions', 'time_off_requests',
    'shift_requests', 'tasks', 'checklist_templates', 'checklist_template_items', 'checklist_runs',
    'checklist_run_items', 'contractors', 'contractor_bookings', 'event_assignments',
    'staff_announcements', 'staff_announcement_reads', 'staff_notifications', 'ops_comments',
    'incidents', 'incident_employees', 'ops_audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Reference data: any signed-in staff member may read; managers write.
create policy locations_staff_read on public.locations for select to authenticated using (true);
create policy locations_manager_write on public.locations for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
-- The public site reads the location a night belongs to.
create policy locations_public_read on public.locations for select to anon using (active);

create policy positions_staff_read on public.positions for select to authenticated using (true);
create policy positions_manager_write on public.positions for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Employees: your own row, or every row for a manager.
create policy employees_self_or_manager_read on public.employees for select to authenticated
  using (public.is_manager() or user_id = (select auth.uid()));
create policy employees_self_update on public.employees for update to authenticated
  using (public.is_manager() or id = public.current_employee_id())
  with check (public.is_manager() or id = public.current_employee_id());
create policy employees_manager_insert on public.employees for insert to authenticated
  with check (public.is_manager());
-- No delete policy: an employee is archived, never deleted.

create policy employee_positions_read on public.employee_positions for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy employee_positions_manager_write on public.employee_positions for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy employee_locations_read on public.employee_locations for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy employee_locations_manager_write on public.employee_locations for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Manager-only, deliberately including the employee the note is about.
create policy employee_notes_manager_only on public.employee_notes for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy requirement_types_staff_read on public.requirement_types for select to authenticated
  using (public.is_manager() or (public.is_employee() and active and archived_at is null));
create policy requirement_types_manager_write on public.requirement_types for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy employee_requirements_read on public.employee_requirements for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy employee_requirements_self_update on public.employee_requirements for update to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());
create policy employee_requirements_manager_insert on public.employee_requirements for insert to authenticated
  with check (public.is_manager());
create policy employee_requirements_manager_delete on public.employee_requirements for delete to authenticated
  using (public.is_manager());

create policy training_modules_read on public.training_modules for select to authenticated
  using (public.is_manager() or (public.is_employee() and status = 'published' and archived_at is null));
create policy training_modules_manager_write on public.training_modules for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy training_sections_read on public.training_sections for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.training_modules m where m.id = module_id and m.status = 'published' and m.archived_at is null and public.is_employee()));
create policy training_sections_manager_write on public.training_sections for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy training_questions_read on public.training_questions for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.training_modules m where m.id = module_id and m.status = 'published' and m.archived_at is null and public.is_employee()));
create policy training_questions_manager_write on public.training_questions for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy training_answer_keys_manager_only on public.training_answer_keys for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy training_assignments_read on public.training_assignments for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy training_assignments_self_update on public.training_assignments for update to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());
create policy training_assignments_manager_write on public.training_assignments for insert to authenticated
  with check (public.is_manager());
create policy training_assignments_manager_delete on public.training_assignments for delete to authenticated
  using (public.is_manager());

-- Attempts are graded and written server-side; an employee reads their own.
create policy training_attempts_read on public.training_attempts for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());

-- Shifts: yours, or an open published one, or all of them for a manager.
create policy shifts_read on public.shifts for select to authenticated
  using (
    public.is_manager()
    or (employee_id = public.current_employee_id() and status <> 'draft')
    or (employee_id is null and status = 'published' and public.is_employee())
  );
create policy shifts_self_update on public.shifts for update to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());
create policy shifts_manager_insert on public.shifts for insert to authenticated with check (public.is_manager());
create policy shifts_manager_delete on public.shifts for delete to authenticated using (public.is_manager());

create policy shift_history_read on public.shift_history for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.shifts s where s.id = shift_id and s.employee_id = public.current_employee_id()));

-- Availability: entirely the employee's own.
create policy availability_rules_own on public.availability_rules for all to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());
create policy availability_exceptions_own on public.availability_exceptions for all to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());

create policy time_off_requests_read on public.time_off_requests for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy time_off_requests_write on public.time_off_requests for insert to authenticated
  with check (public.is_manager() or employee_id = public.current_employee_id());
create policy time_off_requests_update on public.time_off_requests for update to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());

-- Coverage requests are visible to every active employee: that is how a
-- shift finds someone to take it.
create policy shift_requests_read on public.shift_requests for select to authenticated
  using (public.is_manager() or public.is_employee());
create policy shift_requests_insert on public.shift_requests for insert to authenticated
  with check (public.is_manager() or requested_by = public.current_employee_id());
create policy shift_requests_update on public.shift_requests for update to authenticated
  using (public.is_manager() or public.is_employee())
  with check (public.is_manager() or public.is_employee());

create policy tasks_read on public.tasks for select to authenticated
  using (public.is_manager() or assigned_to = public.current_employee_id());
create policy tasks_self_update on public.tasks for update to authenticated
  using (public.is_manager() or assigned_to = public.current_employee_id())
  with check (public.is_manager() or assigned_to = public.current_employee_id());
create policy tasks_manager_insert on public.tasks for insert to authenticated with check (public.is_manager());
create policy tasks_manager_delete on public.tasks for delete to authenticated using (public.is_manager());

create policy checklist_templates_read on public.checklist_templates for select to authenticated
  using (public.is_manager() or public.is_employee());
create policy checklist_templates_manager_write on public.checklist_templates for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy checklist_template_items_read on public.checklist_template_items for select to authenticated
  using (public.is_manager() or public.is_employee());
create policy checklist_template_items_manager_write on public.checklist_template_items for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- A run is visible to its assignee, or to anyone at its location when unassigned.
create policy checklist_runs_read on public.checklist_runs for select to authenticated
  using (
    public.is_manager()
    or assigned_employee_id = public.current_employee_id()
    or (assigned_employee_id is null and public.is_employee() and (
      location_id is null or exists (
        select 1 from public.employee_locations el
         where el.employee_id = public.current_employee_id() and el.location_id = checklist_runs.location_id)
      or exists (select 1 from public.employees e where e.id = public.current_employee_id() and e.primary_location_id = checklist_runs.location_id)
    ))
  );
create policy checklist_runs_manager_write on public.checklist_runs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy checklist_run_items_read on public.checklist_run_items for select to authenticated
  using (exists (select 1 from public.checklist_runs r where r.id = run_id));
create policy checklist_run_items_employee_update on public.checklist_run_items for update to authenticated
  using (exists (select 1 from public.checklist_runs r where r.id = run_id))
  with check (exists (select 1 from public.checklist_runs r where r.id = run_id));
create policy checklist_run_items_manager_write on public.checklist_run_items for insert to authenticated
  with check (public.is_manager());
create policy checklist_run_items_manager_delete on public.checklist_run_items for delete to authenticated
  using (public.is_manager());

create policy contractors_manager_only on public.contractors for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy contractor_bookings_manager_only on public.contractor_bookings for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy event_assignments_read on public.event_assignments for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy event_assignments_manager_write on public.event_assignments for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy staff_announcements_read on public.staff_announcements for select to authenticated
  using (public.is_manager() or (public.is_employee() and published_at is not null and published_at <= now() and archived_at is null));
create policy staff_announcements_manager_write on public.staff_announcements for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy staff_announcement_reads_own on public.staff_announcement_reads for all to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id())
  with check (public.is_manager() or employee_id = public.current_employee_id());

create policy staff_notifications_own_read on public.staff_notifications for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());
create policy staff_notifications_own_update on public.staff_notifications for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());
-- Inserted by the server with the service role; no client insert.

create policy ops_comments_read on public.ops_comments for select to authenticated
  using (
    public.is_manager()
    or author_id = (select auth.uid())
    or (entity_type = 'task' and exists (select 1 from public.tasks t where t.id::text = entity_id and t.assigned_to = public.current_employee_id()))
    or (entity_type = 'time_off_request' and exists (select 1 from public.time_off_requests r where r.id::text = entity_id and r.employee_id = public.current_employee_id()))
    or (entity_type = 'shift_request' and public.is_employee())
    or (entity_type = 'shift' and exists (select 1 from public.shifts s where s.id::text = entity_id and s.employee_id = public.current_employee_id()))
    or (entity_type = 'event_staffing' and exists (select 1 from public.event_assignments a where a.event_id = entity_id and a.employee_id = public.current_employee_id()))
  );
create policy ops_comments_insert on public.ops_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (public.is_manager() or (public.is_employee() and entity_type <> 'incident')));

create policy incidents_manager_only on public.incidents for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy incident_employees_manager_only on public.incident_employees for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy ops_audit_log_manager_read on public.ops_audit_log for select to authenticated
  using (public.is_manager());

-- ---------------------------------------------------- private storage -------

insert into storage.buckets (id, name, public)
values ('employee-files', 'employee-files', false)
on conflict (id) do nothing;

-- Paths: employees/<employee id>/<anything>. An employee may read and write
-- their own folder; a manager any folder. Nothing is public and every read
-- from the app is a short-lived signed URL.
drop policy if exists "employee files own read" on storage.objects;
create policy "employee files own read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-files'
    and (public.is_manager() or (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = public.current_employee_id()::text
    ))
  );

drop policy if exists "employee files own write" on storage.objects;
create policy "employee files own write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-files'
    and (public.is_manager() or (
      (storage.foldername(name))[1] = 'employees'
      and (storage.foldername(name))[2] = public.current_employee_id()::text
    ))
  );

drop policy if exists "employee files manager remove" on storage.objects;
create policy "employee files manager remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'employee-files' and public.is_manager());

-- --------------------------------------------------------- email log --------

-- The staff emails land in the same log as everything else.
do $$
declare doomed record;
begin
  for doomed in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.email_log'::regclass and contype = 'c'
  loop
    if doomed.def ilike '%confirmation%' then
      execute format('alter table public.email_log drop constraint %I', doomed.conname);
    end if;
  end loop;
end $$;

alter table public.email_log add constraint email_log_type_known
  check (type in (
    'confirmation', 'reminder', 'tonight', 'resend', 'thanks',
    'refund', 'event_update', 'cancellation',
    'staff_invitation', 'magic_link', 'password_reset', 'verify_email', 'welcome',
    'owner_alert',
    'staff_welcome', 'schedule_published', 'shift_changed', 'time_off_decision',
    'training_required', 'document_expiring', 'event_assignment'
  ));

-- ------------------------------------------------- default requirements ----

-- The onboarding checklist Casa Aurelia starts with. Nothing legal is asserted: each
-- row is a slot management fills with its own form, link or policy text.
--
-- The ids are FIXED, and match src/content/staff-reference.ts. supabase/seed.sql
-- carries the same twelve rows, and a generated id here would collide with them
-- on the slug unique index the second time one of the two ran.
insert into public.requirement_types (id, slug, title, description, category, kind, system_key, required, onboarding, sort) values
  ('c05a0000-0000-4000-8000-0000000000a1', 'welcome',            'Welcome to Casa Aurelia',          'Read the welcome note and what to expect in your first week.', 'handbook',   'acknowledgement', null,                true,  true, 0),
  ('c05a0000-0000-4000-8000-0000000000a2', 'personal-details',   'Personal details',          'Your name, phone and how we should address you.',            'profile',    'system', 'personal_details',  true,  true, 10),
  ('c05a0000-0000-4000-8000-0000000000a3', 'emergency-contact',  'Emergency contact',         'Who we call if something happens at work.',                  'profile',    'system', 'emergency_contact', true,  true, 20),
  ('c05a0000-0000-4000-8000-0000000000a4', 'availability',       'Availability',              'The days and times you can work.',                           'profile',    'system', 'availability',      true,  true, 30),
  ('c05a0000-0000-4000-8000-0000000000a5', 'positions',          'Position assignment',       'A manager assigns the positions you work.',                  'profile',    'system', 'positions',         true,  true, 40),
  ('c05a0000-0000-4000-8000-0000000000a6', 'location',           'Location assignment',       'A manager assigns where you work.',                          'profile',    'system', 'location',          true,  true, 50),
  ('c05a0000-0000-4000-8000-0000000000a7', 'uniform',            'Uniform',                   'Your shirt size and the uniform agreement.',                 'uniform',    'acknowledgement', null,        true,  true, 60),
  ('c05a0000-0000-4000-8000-0000000000a8', 'employee-policies',  'Employee policies',         'The house policies every employee acknowledges.',            'policy',     'acknowledgement', null,        true,  true, 70),
  ('c05a0000-0000-4000-8000-0000000000a9', 'payroll-paperwork',  'Tax and payroll paperwork', 'Completed on the payroll provider''s site; a manager confirms it is in.', 'payroll', 'manager_verify', null, true, true, 80),
  ('c05a0000-0000-4000-8000-0000000000b1', 'food-handler',       'Food handler certificate',  'Upload your certificate. Required for kitchen and food-running positions where Casa Aurelia policy says so.', 'certification', 'upload', null, false, true, 90),
  ('c05a0000-0000-4000-8000-0000000000b2', 'basset',             'BASSET / alcohol service',  'Upload your BASSET card. Whether it is required per position is a Casa Aurelia policy setting.', 'certification', 'upload', null, false, true, 100),
  ('c05a0000-0000-4000-8000-0000000000b3', 'first-shift',        'First shift confirmed',     'Your first shift is on the schedule and you have confirmed it.', 'profile', 'system', 'first_shift',      true,  true, 110)
on conflict (id) do nothing;

update public.requirement_types set expires_after_days = 1095 where slug in ('food-handler', 'basset') and expires_after_days is null;
update public.requirement_types set applies_to_positions = array['kitchen', 'server', 'busser'] where slug = 'food-handler' and applies_to_positions = '{}';
update public.requirement_types set applies_to_positions = array['bartender', 'server', 'manager'] where slug = 'basset' and applies_to_positions = '{}';

-- Rollback list (drop in this order):
--   incident_employees, incidents, ops_comments, staff_notifications,
--   staff_announcement_reads, staff_announcements, event_assignments,
--   contractor_bookings, contractors, checklist_run_items, checklist_runs,
--   checklist_template_items, checklist_templates, tasks, shift_requests,
--   time_off_requests, availability_exceptions, availability_rules,
--   shift_history, shifts, training_attempts, training_assignments,
--   training_answer_keys, training_questions, training_sections,
--   employee_requirements, requirement_types, training_modules,
--   employee_notes, employee_locations, employee_positions, employees,
--   positions, ops_audit_log; then the location columns and locations.
