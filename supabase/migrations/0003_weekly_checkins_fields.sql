-- =============================================================================
-- Recomp — Migration 0003: weekly_checkins fields for the Logs page
-- =============================================================================
-- Run this in the Supabase SQL editor, same as the other migrations in this
-- folder. Safe to run more than once.
--
-- Why: the Stage 1 schema guessed at weekly_checkins' shape before any UI
-- existed (energy_level, sleep_quality, adherence_pct, a manually-entered
-- weight_kg). The Stage 4 (Logs page) spec settled on a different, more
-- specific shape: energy_rating, sleep_rating, sessions_completed (0-4,
-- matching the 4-day program), and an avg_weight_kg that's computed from
-- weight_logs and stored alongside the manual fields rather than entered
-- by hand. This migration renames the two matching fields and adds the two
-- new ones.
--
-- No data is lost: weekly_checkins has never had any real rows (no UI
-- wrote to it before this stage), so renames are purely cosmetic here.
-- Pre-existing, now-unused columns (weight_kg, waist_cm, adherence_pct)
-- are left in place rather than dropped — the Logs page just doesn't
-- write to them.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_checkins' and column_name = 'energy_level'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_checkins' and column_name = 'energy_rating'
  ) then
    alter table weekly_checkins rename column energy_level to energy_rating;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_checkins' and column_name = 'sleep_quality'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_checkins' and column_name = 'sleep_rating'
  ) then
    alter table weekly_checkins rename column sleep_quality to sleep_rating;
  end if;
end $$;

alter table weekly_checkins
  add column if not exists sessions_completed integer
  check (sessions_completed is null or sessions_completed between 0 and 4);

alter table weekly_checkins
  add column if not exists avg_weight_kg numeric;
