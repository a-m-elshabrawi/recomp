-- =============================================================================
-- Recomp — Database Schema
-- =============================================================================
-- How to use this file:
--   1. Open your Supabase project.
--   2. Go to the "SQL Editor" tab in the left sidebar.
--   3. Click "New query", paste this ENTIRE file, and click "Run".
--   4. It is safe to re-run this file on a fresh project. It is NOT safe to
--      re-run on a project that already has data you care about, because the
--      DROP TABLE statements at the top will delete everything.
--   5. This file always reflects the CURRENT full schema (a fresh project
--      gets everything in one shot). If you already ran this file once and
--      just need to pick up later changes without losing data, look in
--      supabase/migrations/ instead — those files are additive-only and
--      safe to run against an existing database.
--
-- What this file does, in order:
--   A. Extensions this schema depends on.
--   B. Drops any old version of these tables (safe on a fresh project).
--   C. Creates the 10 application tables that make up the Recomp data model.
--   D. Enables Row Level Security (RLS) on every table and adds policies so
--      a logged-in user can only ever see/change their OWN rows.
--   E. Creates a trigger that fires automatically whenever a new user signs
--      up (i.e. a new row appears in Supabase's built-in `auth.users` table).
--      That trigger seeds the new user's profile, default nutrition targets,
--      and a starter "4-Day Bodyweight Recomp" workout program so the app is
--      never empty on first login.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A. EXTENSIONS
-- -----------------------------------------------------------------------------
-- gen_random_uuid() (used as the default value for every primary key below)
-- lives in the pgcrypto extension. Supabase projects usually have this on
-- already, but "create extension if not exists" makes the script safe to run
-- regardless.
create extension if not exists pgcrypto;


-- -----------------------------------------------------------------------------
-- B. CLEAN SLATE
-- -----------------------------------------------------------------------------
-- Drop in dependency order (children before parents) so this script can be
-- re-run from scratch on a fresh/empty project without foreign-key errors.
-- CASCADE also removes any policies/indexes attached to these tables.
drop table if exists coach_messages cascade;
drop table if exists coach_conversations cascade;
drop table if exists exercise_logs cascade;
drop table if exists workout_logs cascade;
drop table if exists program_exercises cascade;
drop table if exists program_days cascade;
drop table if exists programs cascade;
drop table if exists weight_logs cascade;
drop table if exists nutrition_logs cascade;
drop table if exists weekly_checkins cascade;
drop table if exists nutrition_targets cascade;
drop table if exists profiles cascade;


-- =============================================================================
-- C. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- One row per user, extending Supabase's built-in `auth.users` table with the
-- app-specific fields we need (name, body stats, goal, unit preference).
--
-- NOTE: unlike every other table in this file, `profiles` does not have a
-- separate `user_id` column — its primary key `id` IS the user's id
-- (it points straight at auth.users.id). So its RLS policy checks
-- `auth.uid() = id` instead of `auth.uid() = user_id`. Every other table
-- below has a real `user_id` column and uses `auth.uid() = user_id`.
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  date_of_birth     date,
  sex               text check (sex in ('male', 'female', 'other')),
  height_cm         numeric,
  -- Reference "starting point" weight, distinct from the ongoing daily
  -- weight_logs time series (added in migration 0005).
  baseline_weight_kg numeric,
  -- Free text so the AI coach (and eventually a program editor) can be
  -- aware of injuries/limitations (added in migration 0005).
  injury_notes      text,
  activity_level    text check (
                       activity_level in (
                         'sedentary', 'lightly_active', 'moderately_active',
                         'very_active', 'extremely_active'
                       )
                     ),
  goal              text check (goal in ('lose_fat', 'maintain', 'build_muscle', 'recomp')) default 'recomp',
  -- The app currently displays metric units (kg/cm) everywhere regardless
  -- of this value — no UI reads it. Kept, defaulted to 'metric', in case a
  -- future Settings page reintroduces a real per-user unit preference;
  -- see migration 0004.
  units             text check (units in ('metric', 'imperial')) default 'metric',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table profiles is 'One row per user. Primary key = auth.users.id (not a separate user_id column).';


-- -----------------------------------------------------------------------------
-- nutrition_targets
-- -----------------------------------------------------------------------------
-- A user's daily calorie/macro targets. Stored as a history (not just a
-- single row) so targets can change over time as the user progresses —
-- only the row with is_active = true is the "current" target.
create table nutrition_targets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  calories_target    integer not null,
  protein_target_g   integer not null,
  carbs_target_g     integer not null,
  fat_target_g       integer not null,
  -- Estimated maintenance calorie level, distinct from calories_target
  -- (which may be a deliberate deficit/surplus relative to it). Added in
  -- migration 0005; nullable since older rows won't have it.
  maintenance_kcal   integer,
  effective_date     date not null default current_date,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

comment on table nutrition_targets is 'History of daily calorie/macro targets per user; only one row per user should have is_active = true.';


-- -----------------------------------------------------------------------------
-- programs
-- -----------------------------------------------------------------------------
-- A workout program (e.g. "4-Day Bodyweight Recomp"). A user can own several
-- programs over time, but typically only one is_active = true at once.
create table programs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- program_days
-- -----------------------------------------------------------------------------
-- A single training day within a program (e.g. "Day 1: Upper Body Push").
-- day_order controls the display/rotation order (1, 2, 3, 4, ...).
create table program_days (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references programs(id) on delete cascade,
  day_order    integer not null,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (program_id, day_order)
);


-- -----------------------------------------------------------------------------
-- program_exercises
-- -----------------------------------------------------------------------------
-- A single exercise prescribed within a program day (e.g. "Push-Ups, 4 sets
-- x 8-15 reps"). `reps` is text (not a number) because prescriptions vary:
-- "8-12", "AMRAP" (as many reps as possible), "30s", etc.
create table program_exercises (
  id               uuid primary key default gen_random_uuid(),
  program_day_id   uuid not null references program_days(id) on delete cascade,
  exercise_order   integer not null,
  name             text not null,
  sets             integer not null,
  reps             text not null,
  rest_seconds     integer,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (program_day_id, exercise_order)
);


-- -----------------------------------------------------------------------------
-- workout_logs
-- -----------------------------------------------------------------------------
-- One row per workout SESSION the user actually performed (as opposed to
-- program_days, which is the planned/prescribed template). Links back to the
-- program_day it was based on, but that link is optional (on delete set
-- null) so a logged workout survives even if the program is later edited or
-- deleted.
create table workout_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  program_day_id     uuid references program_days(id) on delete set null,
  performed_at       timestamptz not null default now(),
  -- Plain calendar date this session belongs to (added in migration 0001).
  -- Kept separate from performed_at so "find/create today's row" is a
  -- simple equality check instead of a date-truncation query, and so we
  -- can enforce one row per user per day below.
  log_date           date not null default current_date,
  -- Set true via the dashboard's "Mark session complete" action (added in
  -- migration 0001). A workout_logs row can exist with sets logged and
  -- completed still false — completion is a separate, explicit step.
  completed          boolean not null default false,
  duration_minutes   integer,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (user_id, log_date)
);


-- -----------------------------------------------------------------------------
-- exercise_logs
-- -----------------------------------------------------------------------------
-- One row per SET performed within a workout_logs session (e.g. "Set 2 of
-- Push-Ups: 12 reps"). exercise_name is stored redundantly (denormalized)
-- so the historical log still reads correctly even if the source
-- program_exercises row is later renamed or deleted.
--
-- This table has NO user_id column of its own — ownership is determined by
-- joining up to workout_logs.user_id. See the RLS policy below for exactly
-- how that join works.
create table exercise_logs (
  id                    uuid primary key default gen_random_uuid(),
  workout_log_id        uuid not null references workout_logs(id) on delete cascade,
  program_exercise_id   uuid references program_exercises(id) on delete set null,
  exercise_name         text not null,
  set_number            integer not null,
  -- Added in migration 0002: NULL is fine (no reps entered yet), but a
  -- number can't be negative.
  reps_completed        integer check (reps_completed is null or reps_completed >= 0),
  weight_kg             numeric,
  rpe                   numeric(3, 1),
  notes                 text,
  created_at            timestamptz not null default now(),
  -- One row per set within a workout (added in migration 0001), so
  -- correcting a set's reps updates it in place instead of inserting a
  -- duplicate row for the same set_number.
  unique (workout_log_id, program_exercise_id, set_number)
);

comment on table exercise_logs is 'No user_id column — ownership comes via workout_log_id -> workout_logs.user_id.';


-- -----------------------------------------------------------------------------
-- weight_logs
-- -----------------------------------------------------------------------------
-- Body weight check-ins. weight_kg is the canonical stored unit, and the
-- app displays it as-is (kg) — see lib/units.ts. One entry per user per
-- day.
create table weight_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_date   date not null default current_date,
  weight_kg     numeric not null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (user_id, logged_date)
);


-- -----------------------------------------------------------------------------
-- nutrition_logs
-- -----------------------------------------------------------------------------
-- Daily nutrition totals (not per-meal — just one summary row per day).
-- One entry per user per day.
create table nutrition_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_date   date not null default current_date,
  calories      integer,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (user_id, logged_date)
);


-- -----------------------------------------------------------------------------
-- weekly_checkins
-- -----------------------------------------------------------------------------
-- A weekly review/reflection row: subjective ratings, adherence, and
-- free-text notes. One entry per user per week (week_start_date is the
-- Monday — see lib/dashboard/schedule.ts for the week-boundary convention
-- used throughout the app).
--
-- weight_kg, waist_cm, and adherence_pct were part of the original Stage 1
-- guess at this table's shape, before the Logs page (Stage 4) settled on
-- energy_rating/sleep_rating/sessions_completed/avg_weight_kg instead (see
-- migration 0003). The three old columns are kept, unused, rather than
-- dropped, since dropping is a needless destructive step for columns that
-- just sit there empty.
create table weekly_checkins (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  week_start_date      date not null,
  weight_kg            numeric,
  waist_cm             numeric,
  adherence_pct        integer check (adherence_pct between 0 and 100),
  -- Subjective 1-5 ratings entered on the Logs page.
  energy_rating        integer check (energy_rating between 1 and 5),
  sleep_rating         integer check (sleep_rating between 1 and 5),
  -- Manually entered: how many of the program's 4 sessions were completed
  -- that week (this mirrors, but is independently entered from, the
  -- dashboard's auto-computed weekly count).
  sessions_completed   integer check (sessions_completed is null or sessions_completed between 0 and 4),
  -- Computed from weight_logs at submit time (average weight_kg within
  -- the Monday-Sunday week starting at week_start_date) and stored here,
  -- not entered by hand.
  avg_weight_kg        numeric,
  notes                text,
  created_at           timestamptz not null default now(),
  unique (user_id, week_start_date)
);


-- -----------------------------------------------------------------------------
-- coach_conversations / coach_messages
-- -----------------------------------------------------------------------------
-- AI Coach conversation history (added in migration 0006). One
-- coach_conversations row per thread; coach_messages holds the individual
-- turns. coach_messages has no user_id column of its own — ownership is
-- via conversation_id -> coach_conversations.user_id, same pattern as
-- exercise_logs -> workout_logs above.
create table coach_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Set once from the first user message when the conversation is
  -- created, never regenerated afterward. Null until then.
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table coach_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references coach_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);


-- Helpful indexes for the lookups the app will do constantly (fetch "my
-- rows, most recent first" / "my rows for this parent").
create index idx_nutrition_targets_user_active on nutrition_targets(user_id, is_active);
create index idx_programs_user on programs(user_id, is_active);
create index idx_program_days_program on program_days(program_id);
create index idx_program_exercises_day on program_exercises(program_day_id);
create index idx_workout_logs_user_date on workout_logs(user_id, performed_at desc);
create index idx_workout_logs_user_log_date on workout_logs(user_id, log_date desc);
create index idx_workout_logs_user_completed on workout_logs(user_id, completed);
create index idx_exercise_logs_workout on exercise_logs(workout_log_id);
create index idx_weight_logs_user_date on weight_logs(user_id, logged_date desc);
create index idx_nutrition_logs_user_date on nutrition_logs(user_id, logged_date desc);
create index idx_weekly_checkins_user_date on weekly_checkins(user_id, week_start_date desc);
create index idx_coach_conversations_user on coach_conversations(user_id, updated_at desc);
create index idx_coach_messages_conversation on coach_messages(conversation_id, created_at);


-- =============================================================================
-- D. ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS is Postgres's built-in per-row permission system. With it ON and no
-- policies, a table is completely locked down (nobody can read or write it
-- via the public API) — policies are what re-open specific, narrow access.
--
-- Every policy below boils down to "you may only see/change rows that
-- belong to you", where "belong to you" means auth.uid() (the currently
-- logged-in user's id, as provided by Supabase Auth) matches the row's
-- user_id — or, for tables without their own user_id column, matches the
-- user_id of a parent row reached via a join/EXISTS subquery.
--
-- We use `for all using (...) with check (...)` on each table:
--   - `using`      controls which existing rows you can SELECT/UPDATE/DELETE.
--   - `with check` controls what values are allowed on INSERT/UPDATE.
-- Using the same condition for both means: you can only ever read, write,
-- or delete rows that are yours — never anyone else's.

alter table profiles           enable row level security;
alter table nutrition_targets  enable row level security;
alter table programs           enable row level security;
alter table program_days       enable row level security;
alter table program_exercises  enable row level security;
alter table workout_logs       enable row level security;
alter table exercise_logs      enable row level security;
alter table weight_logs        enable row level security;
alter table nutrition_logs     enable row level security;
alter table weekly_checkins    enable row level security;
alter table coach_conversations enable row level security;
alter table coach_messages     enable row level security;

-- profiles: id IS the user id (see note on the table definition above).
create policy "Users can manage their own profile"
  on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- nutrition_targets: direct user_id column.
create policy "Users can manage their own nutrition targets"
  on nutrition_targets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- programs: direct user_id column.
create policy "Users can manage their own programs"
  on programs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- program_days: no user_id column — join up to programs.user_id.
create policy "Users can manage their own program days"
  on program_days
  for all
  using (
    exists (
      select 1 from programs
      where programs.id = program_days.program_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from programs
      where programs.id = program_days.program_id
        and programs.user_id = auth.uid()
    )
  );

-- program_exercises: no user_id column — join up to program_days -> programs.
create policy "Users can manage their own program exercises"
  on program_exercises
  for all
  using (
    exists (
      select 1
      from program_days
      join programs on programs.id = program_days.program_id
      where program_days.id = program_exercises.program_day_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from program_days
      join programs on programs.id = program_days.program_id
      where program_days.id = program_exercises.program_day_id
        and programs.user_id = auth.uid()
    )
  );

-- workout_logs: direct user_id column.
create policy "Users can manage their own workout logs"
  on workout_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exercise_logs: no user_id column — join up to workout_logs.user_id.
create policy "Users can manage their own exercise logs"
  on exercise_logs
  for all
  using (
    exists (
      select 1 from workout_logs
      where workout_logs.id = exercise_logs.workout_log_id
        and workout_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_logs
      where workout_logs.id = exercise_logs.workout_log_id
        and workout_logs.user_id = auth.uid()
    )
  );

-- weight_logs: direct user_id column.
create policy "Users can manage their own weight logs"
  on weight_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- nutrition_logs: direct user_id column.
create policy "Users can manage their own nutrition logs"
  on nutrition_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- weekly_checkins: direct user_id column.
create policy "Users can manage their own weekly checkins"
  on weekly_checkins
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- coach_conversations: direct user_id column.
create policy "Users can manage their own coach conversations"
  on coach_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- coach_messages: no user_id column — join up to coach_conversations.user_id.
create policy "Users can manage their own coach messages"
  on coach_messages
  for all
  using (
    exists (
      select 1 from coach_conversations
      where coach_conversations.id = coach_messages.conversation_id
        and coach_conversations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from coach_conversations
      where coach_conversations.id = coach_messages.conversation_id
        and coach_conversations.user_id = auth.uid()
    )
  );


-- =============================================================================
-- E. NEW USER SEED TRIGGER
-- =============================================================================
-- Supabase Auth keeps its own `auth.users` table that we don't own and can't
-- add columns to directly. Instead, whenever a row is INSERTed there (i.e.
-- someone signs up), this trigger fires and creates all the starter data a
-- brand-new Recomp user needs:
--   1. A blank `profiles` row (so the app never has to null-check "does this
--      user have a profile yet?").
--   2. A starter `nutrition_targets` row with generic beginner numbers the
--      user can edit later in settings.
--   3. One active `programs` row named "4-Day Bodyweight Recomp", with its
--      4 `program_days` and every `program_exercises` row filled in, so the
--      user has a real workout plan to follow on day one — no empty state.
--
-- `security definer` means this function runs with the permissions of
-- whoever OWNS the function (a superuser-ish role), not the permissions of
-- the brand-new user — which is required, because RLS would otherwise block
-- these inserts (the new user isn't logged in yet at the moment their
-- auth.users row is created).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_program_id  uuid;
  day1_id         uuid;
  day2_id         uuid;
  day3_id         uuid;
  day4_id         uuid;
begin
  -- 1. Seed profile.
  insert into public.profiles (id)
  values (new.id);

  -- 2. Seed starter nutrition targets. These are deliberately generic
  --    (roughly a maintenance level for an average adult) — the user is
  --    expected to tune them for their own stats once the app's settings
  --    page exists.
  insert into public.nutrition_targets (
    user_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, is_active
  )
  values (
    new.id, 2200, 160, 220, 70, true
  );

  -- 3. Seed the "4-Day Bodyweight Recomp" starter program.
  insert into public.programs (user_id, name, description, is_active)
  values (
    new.id,
    '4-Day Bodyweight Recomp',
    'A 4-day bodyweight-only split covering upper push, lower body, upper pull, and full-body/core — no equipment required. Generated automatically to get you started; feel free to edit it.',
    true
  )
  returning id into new_program_id;

  -- Day 1: Upper Body Push
  insert into public.program_days (program_id, day_order, name)
  values (new_program_id, 1, 'Day 1: Upper Body Push')
  returning id into day1_id;

  insert into public.program_exercises
    (program_day_id, exercise_order, name, sets, reps, rest_seconds)
  values
    (day1_id, 1, 'Push-Ups',                       4, '8-15',  60),
    (day1_id, 2, 'Pike Push-Ups',                   3, '6-12',  60),
    (day1_id, 3, 'Bench/Chair Dips',                 3, '8-15',  60),
    (day1_id, 4, 'Incline Push-Ups (feet elevated)', 3, '10-15', 45),
    (day1_id, 5, 'Plank Shoulder Taps',              3, '20',    45);

  -- Day 2: Lower Body
  insert into public.program_days (program_id, day_order, name)
  values (new_program_id, 2, 'Day 2: Lower Body')
  returning id into day2_id;

  insert into public.program_exercises
    (program_day_id, exercise_order, name, sets, reps, rest_seconds)
  values
    (day2_id, 1, 'Bodyweight Squats',        4, '15-20',        60),
    (day2_id, 2, 'Bulgarian Split Squats',   3, '10-12 per leg', 60),
    (day2_id, 3, 'Glute Bridges',             3, '15-20',        45),
    (day2_id, 4, 'Walking Lunges',            3, '12 per leg',   60),
    (day2_id, 5, 'Calf Raises',               4, '20',           30);

  -- Day 3: Upper Body Pull
  insert into public.program_days (program_id, day_order, name)
  values (new_program_id, 3, 'Day 3: Upper Body Pull')
  returning id into day3_id;

  insert into public.program_exercises
    (program_day_id, exercise_order, name, sets, reps, rest_seconds)
  values
    (day3_id, 1, 'Pull-Ups or Inverted Rows', 4, '5-10',  90),
    (day3_id, 2, 'Doorway/Table Rows',         3, '8-12',  60),
    (day3_id, 3, 'Superman Holds',             3, '30s',   45),
    (day3_id, 4, 'Reverse Snow Angels',        3, '15',    45),
    (day3_id, 5, 'Towel Isometric Curls',      3, '10s hold x 10', 45);

  -- Day 4: Full Body + Core
  insert into public.program_days (program_id, day_order, name)
  values (new_program_id, 4, 'Day 4: Full Body + Core')
  returning id into day4_id;

  insert into public.program_exercises
    (program_day_id, exercise_order, name, sets, reps, rest_seconds)
  values
    (day4_id, 1, 'Burpees',            3, '10',   60),
    (day4_id, 2, 'Mountain Climbers',  3, '30s',  45),
    (day4_id, 3, 'Jump Squats',        3, '12',   60),
    (day4_id, 4, 'Plank Hold',         3, '45s',  45),
    (day4_id, 5, 'Russian Twists',     3, '20',   45);

  return new;
end;
$$;

-- Attach the function above to auth.users so it runs once per new sign-up.
-- Dropping first makes this script safely re-runnable.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- End of schema. If this script ran without errors, your database is ready:
-- every table exists, RLS is locked down to "users only see their own data",
-- and any new sign-up will automatically get a profile, nutrition targets,
-- and a full starter workout program.
-- =============================================================================
