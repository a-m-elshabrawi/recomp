-- =============================================================================
-- Recomp — Migration 0004: metric units everywhere
-- =============================================================================
-- Run this the same way as the other migrations in this folder (or via the
-- SUPABASE_DB_URL connection now wired up). Safe to run more than once.
--
-- Why: the app now displays weight in kg unconditionally (lib/units.ts no
-- longer branches on a unit preference) — there is no imperial code path
-- left anywhere in the codebase. This migration:
--   1. Changes profiles.units' default from 'imperial' to 'metric', so any
--      future direct inspection of the column isn't misleading.
--   2. Normalizes every existing profile's units to 'metric', matching
--      what the app actually displays for them right now.
--
-- The units column itself is NOT dropped — nothing in the app reads it
-- anymore, but it's left in place (harmless, unused) in case a future
-- Settings page reintroduces a real per-user unit preference. If that
-- never happens, it can be dropped later with a one-line migration; no
-- need to do that destructively now.
-- =============================================================================

alter table profiles alter column units set default 'metric';

update profiles set units = 'metric' where units is distinct from 'metric';
