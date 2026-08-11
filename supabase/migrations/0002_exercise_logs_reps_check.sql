-- =============================================================================
-- Recomp — Migration 0002: reps_completed can't be negative
-- =============================================================================
-- Run this in the Supabase SQL editor, same as the other migrations in this
-- folder. Additive/idempotent — safe to run more than once, and safe to run
-- whether or not migration 0001 has been applied yet (this only touches
-- exercise_logs, and only adds a constraint).
--
-- Note: the dashboard spec calls this "exercise_logs.reps" — the actual
-- column is `reps_completed` (`reps` is a different column, on
-- program_exercises, holding the *target* rep range text like "8-15").
-- This constraint applies to reps_completed, which is what the dashboard's
-- set-logging UI writes.
--
-- NULL is still allowed (a set can be logged with just a note and no rep
-- count yet), so the check only rules out negative numbers, not missing
-- ones.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercise_logs_reps_completed_non_negative'
  ) then
    alter table exercise_logs
      add constraint exercise_logs_reps_completed_non_negative
      check (reps_completed is null or reps_completed >= 0);
  end if;
end $$;
