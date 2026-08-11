-- =============================================================================
-- Recomp — Migration 0001: Dashboard (Stage 3)
-- =============================================================================
-- Run this in the Supabase SQL editor (New query, paste, Run) against your
-- EXISTING project. Unlike supabase/schema.sql, this file is additive only
-- — it does not drop or recreate any table, so it's safe to run without
-- losing the accounts/programs/data you already have.
--
-- It's also safe to run more than once: every statement either uses
-- "if not exists" or checks pg_constraint first before adding anything.
--
-- What this adds, and why:
--   1. workout_logs.log_date — the Stage 1 schema only had `performed_at`
--      (a timestamp), which makes "find today's workout" an awkward
--      date-truncation query. log_date is a plain DATE column so the
--      dashboard can look up/create "today's row" with a simple equality
--      check, and so we can enforce one row per user per day.
--   2. workout_logs.completed — the Stage 3 spec needs a "mark session
--      complete" flag, which didn't exist yet.
--   3. Uniqueness constraints — so the app can *upsert* instead of
--      duplicating rows (one workout_logs row per user per day; one
--      exercise_logs row per set within a workout).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. workout_logs.log_date
-- -----------------------------------------------------------------------------
-- Add as nullable first so existing rows (if any) can be backfilled from
-- their actual performed_at date, rather than defaulting every pre-existing
-- row to "today".
alter table workout_logs
  add column if not exists log_date date;

update workout_logs
set log_date = performed_at::date
where log_date is null;

alter table workout_logs
  alter column log_date set default current_date;

alter table workout_logs
  alter column log_date set not null;


-- -----------------------------------------------------------------------------
-- 2. workout_logs.completed
-- -----------------------------------------------------------------------------
-- A constant boolean default is a metadata-only change in Postgres (no
-- table rewrite needed), so this one's safe to add directly as NOT NULL.
alter table workout_logs
  add column if not exists completed boolean not null default false;


-- -----------------------------------------------------------------------------
-- 3. Uniqueness constraints
-- -----------------------------------------------------------------------------
-- One workout_logs row per user per calendar day.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_logs_user_log_date_key'
  ) then
    alter table workout_logs
      add constraint workout_logs_user_log_date_key unique (user_id, log_date);
  end if;
end $$;

-- One exercise_logs row per set within a workout, so correcting a set's
-- reps updates that row instead of inserting a duplicate.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercise_logs_set_key'
  ) then
    alter table exercise_logs
      add constraint exercise_logs_set_key
      unique (workout_log_id, program_exercise_id, set_number);
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- Indexes for the dashboard's lookups
-- -----------------------------------------------------------------------------
create index if not exists idx_workout_logs_user_log_date
  on workout_logs(user_id, log_date desc);

create index if not exists idx_workout_logs_user_completed
  on workout_logs(user_id, completed);

-- =============================================================================
-- End of migration. If this ran without errors, the dashboard's set-logging
-- and "mark complete" features are ready to use.
-- =============================================================================
