-- =============================================================================
-- Recomp — demo account RLS isolation check
-- =============================================================================
--
--   psql "$SUPABASE_DB_URL" -f scripts/verify-demo-rls.sql
--
-- Proves that the public demo account (demo@recomp.app, credentials in
-- README.md) cannot read or write any other account's rows, by actually
-- exercising the policies rather than reading them.
--
-- How it works:
--   1. Picks a real non-demo account as the "victim" and inserts one
--      fixture row for it in every table, capturing each row's id.
--   2. Switches the session to the `authenticated` Postgres role with the
--      demo user's id in request.jwt.claims — which is exactly what
--      PostgREST does for a logged-in Supabase session, and is what makes
--      auth.uid() return the demo user's id. SET ROLE also drops the
--      postgres role's BYPASSRLS, so the policies genuinely apply.
--   3. Tries to read, update, delete, and insert against the victim's rows
--      by primary key. Every attempt must affect/return zero rows or fail.
--   4. Repeats the read half as the `anon` role (a logged-out visitor).
--
-- Reading by known primary key matters: a join-based test would return zero
-- rows even under a broken policy, simply because the parent is hidden too.
-- Asking "can you see THIS row, which definitely exists?" is the real test.
--
-- Every check also asserts the demo user CAN see its own rows. Without that,
-- a policy that denied everything to everyone would pass silently and prove
-- nothing.
--
-- The whole thing runs in one transaction and ends in ROLLBACK, so the
-- fixture rows never persist and no real account is modified.
-- =============================================================================

\set ON_ERROR_STOP off
\timing off
\pset pager off

begin;

-- ---------------------------------------------------------------------------
-- Identify the two accounts.
-- ---------------------------------------------------------------------------
select id as demo_id from auth.users where email = 'demo@recomp.app' \gset

-- The victim is whichever other account already owns the most data, so the
-- "demo can see its own but not theirs" comparison has real rows on both
-- sides rather than only synthesized ones.
select u.id as victim_id
from auth.users u
where u.email <> 'demo@recomp.app'
order by (
  (select count(*) from weight_logs w where w.user_id = u.id) +
  (select count(*) from workout_logs w where w.user_id = u.id) +
  (select count(*) from nutrition_logs n where n.user_id = u.id)
) desc, u.created_at asc
limit 1 \gset

\echo ''
\echo '=== accounts under test ==='
select
  (select email from auth.users where id = :'demo_id')   as demo_account,
  (select email from auth.users where id = :'victim_id') as victim_account;

-- ---------------------------------------------------------------------------
-- Fixture rows for the victim, one per table, in tables where they may not
-- already have any. Dated 1999-01-04 (a Monday, for weekly_checkins) so they
-- can never collide with real data under the per-day/per-week unique keys.
-- ---------------------------------------------------------------------------
insert into workout_logs (user_id, log_date, performed_at, completed, notes)
values (:'victim_id', '1999-01-04', '1999-01-04T18:00:00Z', true, 'rls fixture')
returning id as v_workout_log \gset

insert into exercise_logs (workout_log_id, exercise_name, set_number, reps_completed)
values (:'v_workout_log', 'RLS Fixture Press', 1, 10)
returning id as v_exercise_log \gset

insert into weight_logs (user_id, logged_date, weight_kg)
values (:'victim_id', '1999-01-04', 99.9)
returning id as v_weight_log \gset

insert into nutrition_logs (user_id, logged_date, calories, protein_g, carbs_g, fat_g)
values (:'victim_id', '1999-01-04', 2000, 150, 200, 60)
returning id as v_nutrition_log \gset

insert into weekly_checkins (user_id, week_start_date, energy_rating, sleep_rating, sessions_completed)
values (:'victim_id', '1999-01-04', 3, 3, 2)
returning id as v_checkin \gset

insert into nutrition_targets (user_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, effective_date, is_active)
values (:'victim_id', 2100, 150, 200, 60, '1999-01-04', false)
returning id as v_target \gset

insert into coach_conversations (user_id, title)
values (:'victim_id', 'RLS fixture conversation')
returning id as v_conversation \gset

insert into coach_messages (conversation_id, role, content)
values (:'v_conversation', 'user', 'RLS fixture message — must never be visible to the demo account.')
returning id as v_message \gset

-- The victim's existing program/day/exercise rows, seeded by
-- handle_new_user() at sign-up. No fixture needed.
select id as v_program from programs where user_id = :'victim_id' order by created_at limit 1 \gset
select id as v_program_day from program_days where program_id = :'v_program' order by day_order limit 1 \gset
select id as v_program_exercise from program_exercises where program_day_id = :'v_program_day' order by exercise_order limit 1 \gset

-- The demo's own equivalents, for the "can still see my own data" half.
select id as d_workout_log      from workout_logs       where user_id = :'demo_id' order by log_date desc limit 1 \gset
select id as d_program          from programs           where user_id = :'demo_id' limit 1 \gset
select id as d_conversation     from coach_conversations where user_id = :'demo_id' limit 1 \gset


-- ===========================================================================
-- Become the demo user.
-- ===========================================================================
-- set_config(..., is_local => true) is SET LOCAL, and unlike SET it takes a
-- computed value, so the demo user's id can be interpolated into the claims
-- blob. This is the same setting PostgREST populates from a session's JWT.
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', :'demo_id')::text,
  true
) is not null as claims_set;

set local role authenticated;

\echo ''
\echo '=== session identity (auth.uid() must be the demo user) ==='
select current_user as pg_role, auth.uid() as auth_uid, auth.uid() = :'demo_id'::uuid as is_demo;


\echo ''
\echo '=== READ: victim rows visible to demo (all must be 0) ==='
select 'profiles'            as tbl, count(*) as victim_rows_visible from profiles            where id = :'victim_id'
union all select 'nutrition_targets',  count(*) from nutrition_targets   where id = :'v_target'
union all select 'programs',           count(*) from programs            where id = :'v_program'
union all select 'program_days',       count(*) from program_days        where id = :'v_program_day'
union all select 'program_exercises',  count(*) from program_exercises   where id = :'v_program_exercise'
union all select 'workout_logs',       count(*) from workout_logs        where id = :'v_workout_log'
union all select 'exercise_logs',      count(*) from exercise_logs       where id = :'v_exercise_log'
union all select 'weight_logs',        count(*) from weight_logs         where id = :'v_weight_log'
union all select 'nutrition_logs',     count(*) from nutrition_logs      where id = :'v_nutrition_log'
union all select 'weekly_checkins',    count(*) from weekly_checkins     where id = :'v_checkin'
union all select 'coach_conversations',count(*) from coach_conversations where id = :'v_conversation'
union all select 'coach_messages',     count(*) from coach_messages      where id = :'v_message'
order by 1;

\echo ''
\echo '=== READ: total rows visible vs. rows the demo owns ==='
\echo '(they must be equal, and non-zero, on every table)'
select 'profiles' as tbl,
       (select count(*) from profiles) as visible,
       (select count(*) from profiles where id = :'demo_id') as owned
union all select 'nutrition_targets',   (select count(*) from nutrition_targets),   (select count(*) from nutrition_targets   where user_id = :'demo_id')
union all select 'programs',            (select count(*) from programs),            (select count(*) from programs            where user_id = :'demo_id')
union all select 'program_days',        (select count(*) from program_days),        (select count(*) from program_days        where program_id = :'d_program')
union all select 'program_exercises',   (select count(*) from program_exercises),   (select count(*) from program_exercises   where program_day_id in (select id from program_days where program_id = :'d_program'))
union all select 'workout_logs',        (select count(*) from workout_logs),        (select count(*) from workout_logs        where user_id = :'demo_id')
union all select 'exercise_logs',       (select count(*) from exercise_logs),       (select count(*) from exercise_logs       where workout_log_id in (select id from workout_logs where user_id = :'demo_id'))
union all select 'weight_logs',         (select count(*) from weight_logs),         (select count(*) from weight_logs         where user_id = :'demo_id')
union all select 'nutrition_logs',      (select count(*) from nutrition_logs),      (select count(*) from nutrition_logs      where user_id = :'demo_id')
union all select 'weekly_checkins',     (select count(*) from weekly_checkins),     (select count(*) from weekly_checkins     where user_id = :'demo_id')
union all select 'coach_conversations', (select count(*) from coach_conversations), (select count(*) from coach_conversations where user_id = :'demo_id')
union all select 'coach_messages',      (select count(*) from coach_messages),      (select count(*) from coach_messages      where conversation_id in (select id from coach_conversations where user_id = :'demo_id'))
order by 1;

\echo ''
\echo '=== WRITE: UPDATE victim rows (all must be 0 rows affected) ==='
with a as (update profiles            set full_name       = 'HACKED' where id = :'victim_id'          returning 1),
     b as (update nutrition_targets   set calories_target = 1        where id = :'v_target'           returning 1),
     c as (update programs            set name            = 'HACKED' where id = :'v_program'          returning 1),
     d as (update program_days        set name            = 'HACKED' where id = :'v_program_day'      returning 1),
     e as (update program_exercises   set name            = 'HACKED' where id = :'v_program_exercise' returning 1),
     f as (update workout_logs        set completed       = false    where id = :'v_workout_log'      returning 1),
     g as (update exercise_logs       set reps_completed  = 0        where id = :'v_exercise_log'     returning 1),
     h as (update weight_logs         set weight_kg       = 1        where id = :'v_weight_log'       returning 1),
     i as (update nutrition_logs      set calories        = 1        where id = :'v_nutrition_log'    returning 1),
     j as (update weekly_checkins     set notes           = 'HACKED' where id = :'v_checkin'          returning 1),
     k as (update coach_conversations set title           = 'HACKED' where id = :'v_conversation'     returning 1),
     l as (update coach_messages      set content         = 'HACKED' where id = :'v_message'          returning 1)
select (select count(*) from a) profiles, (select count(*) from b) nutrition_targets,
       (select count(*) from c) programs, (select count(*) from d) program_days,
       (select count(*) from e) program_exercises, (select count(*) from f) workout_logs,
       (select count(*) from g) exercise_logs, (select count(*) from h) weight_logs,
       (select count(*) from i) nutrition_logs, (select count(*) from j) weekly_checkins,
       (select count(*) from k) coach_conversations, (select count(*) from l) coach_messages;

\echo ''
\echo '=== WRITE: DELETE victim rows (all must be 0 rows affected) ==='
with a as (delete from nutrition_targets   where id = :'v_target'           returning 1),
     b as (delete from program_exercises   where id = :'v_program_exercise' returning 1),
     c as (delete from program_days        where id = :'v_program_day'      returning 1),
     d as (delete from exercise_logs       where id = :'v_exercise_log'     returning 1),
     e as (delete from workout_logs        where id = :'v_workout_log'      returning 1),
     f as (delete from weight_logs         where id = :'v_weight_log'       returning 1),
     g as (delete from nutrition_logs      where id = :'v_nutrition_log'    returning 1),
     h as (delete from weekly_checkins     where id = :'v_checkin'          returning 1),
     i as (delete from coach_messages      where id = :'v_message'          returning 1),
     j as (delete from coach_conversations where id = :'v_conversation'     returning 1),
     k as (delete from programs            where id = :'v_program'          returning 1),
     l as (delete from profiles            where id = :'victim_id'          returning 1)
select (select count(*) from a) nutrition_targets, (select count(*) from b) program_exercises,
       (select count(*) from c) program_days, (select count(*) from d) exercise_logs,
       (select count(*) from e) workout_logs, (select count(*) from f) weight_logs,
       (select count(*) from g) nutrition_logs, (select count(*) from h) weekly_checkins,
       (select count(*) from i) coach_messages, (select count(*) from j) coach_conversations,
       (select count(*) from k) programs, (select count(*) from l) profiles;

\echo ''
\echo '=== WRITE: INSERT rows owned by the victim (every one must ERROR) ==='
\echo '-- weight_logs with the victim user_id:'
savepoint s1;
insert into weight_logs (user_id, logged_date, weight_kg) values (:'victim_id', '1999-02-01', 70);
rollback to savepoint s1;

\echo '-- nutrition_logs with the victim user_id:'
savepoint s2;
insert into nutrition_logs (user_id, logged_date, calories) values (:'victim_id', '1999-02-01', 100);
rollback to savepoint s2;

\echo '-- workout_logs with the victim user_id:'
savepoint s3;
insert into workout_logs (user_id, log_date) values (:'victim_id', '1999-02-01');
rollback to savepoint s3;

\echo '-- weekly_checkins with the victim user_id:'
savepoint s4;
insert into weekly_checkins (user_id, week_start_date) values (:'victim_id', '1999-02-01');
rollback to savepoint s4;

\echo '-- nutrition_targets with the victim user_id:'
savepoint s5;
insert into nutrition_targets (user_id, calories_target, protein_target_g, carbs_target_g, fat_target_g) values (:'victim_id', 1, 1, 1, 1);
rollback to savepoint s5;

\echo '-- programs with the victim user_id:'
savepoint s6;
insert into programs (user_id, name) values (:'victim_id', 'Injected');
rollback to savepoint s6;

\echo '-- coach_conversations with the victim user_id:'
savepoint s7;
insert into coach_conversations (user_id, title) values (:'victim_id', 'Injected');
rollback to savepoint s7;

\echo '-- exercise_logs attached to the victim workout (no user_id column, parent join):'
savepoint s8;
insert into exercise_logs (workout_log_id, exercise_name, set_number) values (:'v_workout_log', 'Injected', 1);
rollback to savepoint s8;

\echo '-- program_days attached to the victim program (no user_id column, parent join):'
savepoint s9;
insert into program_days (program_id, day_order, name) values (:'v_program', 99, 'Injected');
rollback to savepoint s9;

\echo '-- program_exercises attached to the victim program day (parent join):'
savepoint s10;
insert into program_exercises (program_day_id, exercise_order, name, sets, reps) values (:'v_program_day', 99, 'Injected', 1, '1');
rollback to savepoint s10;

\echo '-- coach_messages attached to the victim conversation (parent join):'
savepoint s11;
insert into coach_messages (conversation_id, role, content) values (:'v_conversation', 'user', 'Injected');
rollback to savepoint s11;

\echo '-- profiles row for the victim id:'
savepoint s12;
insert into profiles (id, full_name) values (:'victim_id', 'Injected');
rollback to savepoint s12;


-- ===========================================================================
-- Become a logged-out visitor.
-- ===========================================================================
reset role;
-- No 'sub' claim, so auth.uid() is NULL — exactly a logged-out visitor.
select set_config('request.jwt.claims', '{"role":"anon"}', true) is not null as claims_set;
set local role anon;

\echo ''
\echo '=== ANON (logged out): rows visible across all tables (all must be 0) ==='
\echo '(anon holds the same table GRANTs as authenticated; RLS is the only'
\echo ' thing standing between a logged-out visitor and every row, because'
\echo ' auth.uid() is NULL so every policy predicate evaluates to NULL.)'
select 'profiles' as tbl, count(*) as rows_visible from profiles
union all select 'nutrition_targets',   count(*) from nutrition_targets
union all select 'programs',            count(*) from programs
union all select 'program_days',        count(*) from program_days
union all select 'program_exercises',   count(*) from program_exercises
union all select 'workout_logs',        count(*) from workout_logs
union all select 'exercise_logs',       count(*) from exercise_logs
union all select 'weight_logs',         count(*) from weight_logs
union all select 'nutrition_logs',      count(*) from nutrition_logs
union all select 'weekly_checkins',     count(*) from weekly_checkins
union all select 'coach_conversations', count(*) from coach_conversations
union all select 'coach_messages',      count(*) from coach_messages
order by 1;

reset role;
rollback;

\echo ''
\echo '=== done — transaction rolled back, no fixture rows persisted ==='
