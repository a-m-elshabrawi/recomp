-- =============================================================================
-- Recomp — Migration 0005: Settings page fields
-- =============================================================================
-- Run the same way as the other migrations in this folder. Additive only,
-- safe to run more than once.
--
-- Why:
--   - profiles.baseline_weight_kg — a reference "starting point" weight,
--     distinct from the ongoing daily weight_logs time series (which
--     already existed). Settings edits this directly.
--   - profiles.injury_notes — free text, so the AI coach (and eventually
--     any program editor) can be aware of injuries/limitations.
--   - nutrition_targets.maintenance_kcal — the user's estimated
--     maintenance calorie level, distinct from calories_target (which may
--     be a deliberate deficit/surplus relative to maintenance). Stage 1's
--     schema only had the target, not the maintenance baseline.
--
-- Note: the Settings spec calls the DOB-related field "age" — this
-- migration does NOT add a stored `age` column. profiles.date_of_birth
-- already exists and is the correct place to store this (age computed
-- from it, e.g. lib/coach/context.ts's ageFromDateOfBirth, rather than
-- stored redundantly and going stale). The Settings form edits
-- date_of_birth directly, labeled "Date of birth".
-- =============================================================================

alter table profiles
  add column if not exists baseline_weight_kg numeric;

alter table profiles
  add column if not exists injury_notes text;

alter table nutrition_targets
  add column if not exists maintenance_kcal integer;
