/**
 * =============================================================================
 * Recomp — demo account seeder
 * =============================================================================
 *
 *   npm run seed:demo
 *
 * Creates (or resets) the public read-only demo account described in
 * README.md's "Try it" section, and fills it with ~12 weeks of generated
 * history so the dashboard and the Recharts progress views have something
 * real-looking to draw.
 *
 * RE-RUNNABLE BY DESIGN. RLS lets the demo user edit its own rows, and the
 * credentials are public, so visitors *will* log sets, change targets, and
 * generally scribble on it. Running this script again deletes every row the
 * demo user owns across all twelve application tables and rebuilds them from
 * scratch, so the account always returns to the same known state. It also
 * re-anchors every date to the day it's run, which is the other reason to
 * re-run it periodically: the data ages otherwise.
 *
 * It only ever touches the demo user's rows — every delete is filtered by
 * that one user id. No other account is read or written.
 *
 * Deterministic: all "randomness" comes from a fixed-seed PRNG below, so two
 * runs on the same day produce byte-identical data.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (read from .env.local). The service role
 * bypasses RLS, which is what lets this script write rows on another
 * account's behalf and create the auth user in the first place.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Demo account credentials
// -----------------------------------------------------------------------------
// Kept in sync by hand with lib/demo.ts (this is a plain .mjs script, so it
// can't import the TypeScript module without a build step).
const DEMO_EMAIL = "demo@recomp.app";
const DEMO_PASSWORD = "RecompDemo2026!";

// How much history to generate. 12 weeks is deliberate: /progress renders
// exactly 12 weeks of workout consistency (CONSISTENCY_WEEKS in
// app/(app)/progress/page.tsx), so this fills that chart edge to edge, and
// it comfortably covers the weight chart's 30d / 90d / all range toggle.
const WEEKS = 12;
const DAYS = WEEKS * 7;

// -----------------------------------------------------------------------------
// Env loading
// -----------------------------------------------------------------------------
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(projectRoot, ".env.local"), "utf8");
  } catch {
    return; // Fall back to whatever's already in process.env.
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Fill them in .env.local (see SETUP.md) and re-run."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -----------------------------------------------------------------------------
// Deterministic PRNG
// -----------------------------------------------------------------------------
// mulberry32 — small, fast, and (unlike Math.random) reproducible, so the
// "known state" this script resets to is genuinely the same every run.
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260818);

/** Uniform noise in [-magnitude, +magnitude]. */
function noise(magnitude) {
  return (random() * 2 - 1) * magnitude;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pick(list) {
  return list[Math.floor(random() * list.length)];
}

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------
// Date keys are plain "YYYY-MM-DD" strings, matching the Postgres `date`
// columns and lib/dashboard/schedule.ts.
//
// These compute in UTC on purpose, while the app's helpers use the server's
// local clock. On Vercel those are the same thing (the runtime is UTC), and
// anchoring the seed to UTC means the generated "today" matches what the
// deployed app considers today regardless of the timezone this script is run
// from.

function dateKeyFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtc(date);
}

/** Monday of the week containing dateKey — the app's week boundary. */
function weekStartOf(dateKey) {
  const dayOfWeek = parseDateKey(dateKey).getUTCDay(); // 0 = Sunday
  return addDays(dateKey, -((dayOfWeek + 6) % 7));
}

/** A timestamptz for a given date key at a plausible time of day. */
function timestampAt(dateKey, hour, minute = 0) {
  return `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
}

const TODAY = dateKeyFromUtc(new Date());
const CURRENT_WEEK_START = weekStartOf(TODAY);
/** 0 = Monday ... 6 = Sunday. How far into the current week today is. */
const TODAY_WEEK_OFFSET = (parseDateKey(TODAY).getUTCDay() + 6) % 7;

// -----------------------------------------------------------------------------
// The program (mirrors the starter program public.handle_new_user() seeds)
// -----------------------------------------------------------------------------
const PROGRAM = {
  name: "4-Day Bodyweight Recomp",
  description:
    "A 4-day bodyweight-only split covering upper push, lower body, upper pull, and full-body/core — no equipment required.",
  days: [
    {
      day_order: 1,
      name: "Day 1: Upper Body Push",
      exercises: [
        { name: "Push-Ups", sets: 4, reps: "8-15", rest_seconds: 60 },
        { name: "Pike Push-Ups", sets: 3, reps: "6-12", rest_seconds: 60 },
        { name: "Bench/Chair Dips", sets: 3, reps: "8-15", rest_seconds: 60 },
        { name: "Incline Push-Ups (feet elevated)", sets: 3, reps: "10-15", rest_seconds: 45 },
        { name: "Plank Shoulder Taps", sets: 3, reps: "20", rest_seconds: 45 },
      ],
    },
    {
      day_order: 2,
      name: "Day 2: Lower Body",
      exercises: [
        { name: "Bodyweight Squats", sets: 4, reps: "15-20", rest_seconds: 60 },
        { name: "Bulgarian Split Squats", sets: 3, reps: "10-12 per leg", rest_seconds: 60 },
        { name: "Glute Bridges", sets: 3, reps: "15-20", rest_seconds: 45 },
        { name: "Walking Lunges", sets: 3, reps: "12 per leg", rest_seconds: 60 },
        { name: "Calf Raises", sets: 4, reps: "20", rest_seconds: 30 },
      ],
    },
    {
      day_order: 3,
      name: "Day 3: Upper Body Pull",
      exercises: [
        { name: "Pull-Ups or Inverted Rows", sets: 4, reps: "5-10", rest_seconds: 90 },
        { name: "Doorway/Table Rows", sets: 3, reps: "8-12", rest_seconds: 60 },
        { name: "Superman Holds", sets: 3, reps: "30s", rest_seconds: 45 },
        { name: "Reverse Snow Angels", sets: 3, reps: "15", rest_seconds: 45 },
        { name: "Towel Isometric Curls", sets: 3, reps: "10s hold x 10", rest_seconds: 45 },
      ],
    },
    {
      day_order: 4,
      name: "Day 4: Full Body + Core",
      exercises: [
        { name: "Burpees", sets: 3, reps: "10", rest_seconds: 60 },
        { name: "Mountain Climbers", sets: 3, reps: "30s", rest_seconds: 45 },
        { name: "Jump Squats", sets: 3, reps: "12", rest_seconds: 60 },
        { name: "Plank Hold", sets: 3, reps: "45s", rest_seconds: 45 },
        { name: "Russian Twists", sets: 3, reps: "20", rest_seconds: 45 },
      ],
    },
  ],
};

/**
 * Turns a prescription string into the [floor, ceiling] rep band a logged
 * set should fall in, so generated numbers stay inside what was actually
 * prescribed instead of drifting somewhere implausible.
 *
 * "8-15" and "10-12 per leg" are explicit ranges. A single number ("20",
 * "30s", "12 per leg", "10s hold x 10") is treated as the starting point,
 * with a ~40% ceiling — that's how these actually progress: you don't rep
 * out a prescribed 45s plank at 45s forever, you creep up to a minute.
 */
function repBand(repsText) {
  const range = repsText.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return [Number(range[1]), Number(range[2])];
  const single = repsText.match(/(\d+)/);
  if (!single) return [10, 14];
  const base = Number(single[1]);
  return [base, Math.ceil(base * 1.4)];
}

// -----------------------------------------------------------------------------
// Training schedule
// -----------------------------------------------------------------------------
// Sessions per week, keyed by how many weeks ago that week started. Read
// right-to-left, this is the story the consistency chart tells: a tentative
// start, a dip during a bad week, then a solid run of full weeks.
//
// weeksAgo 8 dropping to 3 is what caps the dashboard's streak stat at 7 —
// computeStreak() walks backward and stops at the first finished week that
// missed the 4-session target.
const SESSIONS_PER_WEEK = {
  11: 2,
  10: 3,
  9: 4,
  8: 3, // rough week — matches the low energy/sleep check-in below
  7: 4,
  6: 4,
  5: 4,
  4: 4,
  3: 4,
  2: 4,
  1: 4,
};

// Which weekdays get trained, by session count. 0 = Monday.
const WEEKDAYS_BY_COUNT = {
  4: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  3: [0, 2, 4], // Mon, Wed, Fri
  2: [1, 3], // Tue, Thu
};

/**
 * Every session to seed, oldest first.
 *
 * The current (partial) week is special-cased: only the pattern's weekdays
 * that have already passed get a completed session, and today always gets an
 * in-progress one. That leaves the dashboard showing a half-logged workout,
 * which is a far better first impression than a blank card — it's the app's
 * primary interaction, visible without clicking anything.
 */
function buildSessions() {
  const sessions = [];

  for (let weeksAgo = WEEKS - 1; weeksAgo >= 1; weeksAgo--) {
    const weekStart = addDays(CURRENT_WEEK_START, -7 * weeksAgo);
    const count = SESSIONS_PER_WEEK[weeksAgo];
    for (const offset of WEEKDAYS_BY_COUNT[count]) {
      sessions.push({ date: addDays(weekStart, offset), completed: true });
    }
  }

  for (const offset of WEEKDAYS_BY_COUNT[4]) {
    if (offset < TODAY_WEEK_OFFSET) {
      sessions.push({ date: addDays(CURRENT_WEEK_START, offset), completed: true });
    }
  }
  sessions.push({ date: TODAY, completed: false });

  // Rotate through the program's days in order, which is exactly what the
  // dashboard's computeDefaultDayId() expects to see.
  sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  sessions.forEach((session, index) => {
    session.dayIndex = index % PROGRAM.days.length;
    // Progress from 0 (first session) to 1 (most recent), used to trend
    // reps upward over the 12 weeks.
    session.progress = sessions.length > 1 ? index / (sessions.length - 1) : 1;
  });

  return sessions;
}

const SESSIONS = buildSessions();
const SESSION_DATES = new Set(SESSIONS.map((s) => s.date));

const WORKOUT_NOTES = [
  "Felt strong today, everything moved well.",
  "Short on time — cut rest periods to 45s.",
  "Legs still sore from last session, took it easier.",
  "Best session in a while. Added a rep on almost everything.",
  "Low energy start but it came around by the third exercise.",
  "Trained late, felt sluggish. Still got it done.",
];

// -----------------------------------------------------------------------------
// Body weight series
// -----------------------------------------------------------------------------
const START_WEIGHT = 84.8;
const TOTAL_LOSS = 4.4;

/**
 * Fraction of the total loss achieved by day fraction t (0 = 12 weeks ago,
 * 1 = today). Deliberately not linear: a quick initial drop, a flat stretch
 * in the middle, then a steady grind. A perfectly straight line is the
 * giveaway that data is fake, and the plateau is what makes the /progress
 * moving-average line worth looking at.
 */
function lossFraction(t) {
  if (t < 0.35) return (t / 0.35) * 0.45;
  if (t < 0.55) return 0.45 + ((t - 0.35) / 0.2) * 0.08;
  return 0.53 + ((t - 0.55) / 0.45) * 0.47;
}

function weightForDay(dayIndex) {
  const t = dayIndex / (DAYS - 1);
  const trend = START_WEIGHT - TOTAL_LOSS * lossFraction(t);
  // Weekly water-weight swing (heavier at weekends) plus daily scale noise.
  const weekly = Math.sin((dayIndex / 7) * Math.PI * 2) * 0.25;
  return round(trend + weekly + noise(0.3), 1);
}

const WEIGHT_NOTES = [
  "Salty dinner last night.",
  "Weighed in after training instead of first thing.",
  "Slept badly, up early.",
  "Back to normal after the weekend.",
];

// -----------------------------------------------------------------------------
// Nutrition targets
// -----------------------------------------------------------------------------
// Two rows, not one, so the history the table was designed for is actually
// visible: an original target, then a revision six weeks in. Only the newer
// one is active, which is what every query in the app filters on.
const NUTRITION_TARGETS = [
  {
    calories_target: 2600,
    protein_target_g: 165,
    carbs_target_g: 270,
    fat_target_g: 80,
    maintenance_kcal: 2800,
    effective_date: addDays(TODAY, -(DAYS - 1)),
    is_active: false,
  },
  {
    calories_target: 2450,
    protein_target_g: 175,
    carbs_target_g: 245,
    fat_target_g: 75,
    maintenance_kcal: 2750,
    effective_date: addDays(TODAY, -42),
    is_active: true,
  },
];

const NUTRITION_NOTES = [
  "Ate out — calories are an estimate.",
  "Hit protein easily today, three solid meals.",
  "Snacked in the evening, went over.",
  "Meal prepped, everything weighed.",
  "Travel day, ate what was available.",
];

// -----------------------------------------------------------------------------
// Weekly check-ins
// -----------------------------------------------------------------------------
// Hand-written rather than generated: eleven rows is few enough that real
// sentences read better than templated ones, and the ratings need to line up
// with the training story above (see the dip at weeksAgo 8).
const CHECKINS = {
  11: { energy: 3, sleep: 3, notes: "First week back. Only managed two sessions but the plan feels doable." },
  10: { energy: 3, sleep: 4, notes: "Three sessions. Squats are the hardest part right now — legs are unconditioned." },
  9: { energy: 4, sleep: 3, notes: "First full week, all four sessions. Scale finally moving." },
  8: { energy: 2, sleep: 2, notes: "Head cold most of the week, skipped a session. Kept food roughly on track." },
  7: { energy: 4, sleep: 4, notes: "Back to four sessions and felt normal again by Wednesday." },
  6: { energy: 4, sleep: 3, notes: "Dropped calories to 2450 after the weight stalled for ten days." },
  5: { energy: 4, sleep: 4, notes: "Good week. Pull-ups went from 6s to 8s across the board." },
  4: { energy: 5, sleep: 4, notes: "Everything clicking. Protein was on target every single day." },
  3: { energy: 4, sleep: 5, notes: "Sleep has been much better since moving sessions earlier." },
  2: { energy: 5, sleep: 4, notes: "Four sessions, weight down again. Waistband noticeably looser." },
  1: { energy: 5, sleep: 5, notes: "Best week of the block. Push-ups are up into the low teens now." },
};

// -----------------------------------------------------------------------------
// Coach conversations
// -----------------------------------------------------------------------------
// See README.md and app/api/coach/route.ts: live sends are disabled for the
// demo account, so these seeded threads are what the Coach page shows. They
// are written to reflect the data seeded above — the plateau, the 2450 kcal
// revision, the rough week — because the real coach is grounded in exactly
// that history, and a canned conversation that contradicted it would
// misrepresent the feature rather than demonstrate it.
const CONVERSATIONS = [
  {
    daysAgo: 45,
    title: "Why has my weight stalled?",
    messages: [
      {
        role: "user",
        content:
          "My weight hasn't moved in about ten days but I've been sticking to my calories. What's going on?",
      },
      {
        role: "assistant",
        content:
          "Ten days is annoying but it's not a stall in the sense that matters — looking at your logs, you dropped from 84.8 kg to about 82.9 kg over the first five weeks, then flattened. That's a very normal shape, not a broken metabolism.\n\nTwo things stand out. First, your logged intake has been running a little over your 2,600 target on training days and only slightly under it on rest days, so your weekly average is sitting close to maintenance rather than below it. Second, you've been hitting four sessions a week consistently since your cold cleared — new training volume brings water retention in the muscle, which masks fat loss on the scale for a couple of weeks.\n\nIf you want the scale moving again, the smallest change that would do it is trimming to roughly 2,450 kcal and holding protein where it is. Give that a fortnight before judging it, and weigh in daily so you're reading the 7-day average rather than any single morning.",
      },
      {
        role: "user",
        content: "Should I add cardio instead?",
      },
      {
        role: "assistant",
        content:
          "You could, but I'd hold it in reserve. You're already training four days a week and recovering well enough to keep adding reps — adding cardio on top means more to recover from at the exact moment you'd also be eating less.\n\nThe calorie adjustment is the cheaper lever: it costs you nothing in recovery. Keep cardio as the thing you add in a few weeks if the scale stalls again and you'd rather not cut calories further. Walking is the version I'd add first, since it barely touches recovery at all.",
      },
    ],
  },
  {
    daysAgo: 9,
    title: "Shoulder is bothering me on dips",
    messages: [
      {
        role: "user",
        content:
          "My left shoulder has been sore on bench dips again. Should I just push through it or swap the exercise?",
      },
      {
        role: "assistant",
        content:
          "Don't push through it — that's the one case where the usual \"add a rep\" advice doesn't apply. Your profile notes say this shoulder gets cranky on deep dips and that you keep the range of motion shallow when it flares up, so you already know the pattern.\n\nFor the next few Day 1 sessions I'd swap bench dips for close-grip push-ups. You keep the triceps work, the shoulder stays in a much friendlier position, and it slots into the same three sets without changing anything else about the session. Your push-ups are at 13-14 reps now, so a close-grip variation will land somewhere around 8-10 — that's the right kind of hard.\n\nOne caveat I have to give you: I can see your logs, not your shoulder. If it's painful rather than just achy, or it's still there in two weeks, get it looked at properly by a physio rather than working around it indefinitely.",
      },
    ],
  },
  {
    daysAgo: 3,
    title: "How am I doing overall?",
    messages: [
      {
        role: "user",
        content: "Give me an honest read on the last three months.",
      },
      {
        role: "assistant",
        content:
          "Honestly? The consistency is the story here, not the weight.\n\nYou've completed four sessions a week for seven straight weeks, with the only gap being the week you were ill — and you still got three in that week. That's the part most people fail at, and you're doing it without any apparent drama.\n\nThe scale is down roughly 4.4 kg over twelve weeks, which is about 0.37 kg a week. That's a sensible rate for a recomp — fast enough to see, slow enough that you're not burning through muscle to get it.\n\nStrength has moved in the same direction: push-ups from 8 reps to 14, pull-ups from 6 to 9, planks from 46 seconds to a full minute. Losing weight while every lift goes up is exactly what recomposition looks like when it's working.\n\nThe one thing I'd tighten: your protein was inconsistent in the first six weeks, often 20-40 g under target. It's been much better lately. Keep it there — at a deficit, protein is what decides whether the weight you lose is fat or muscle.",
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Supabase helpers
// -----------------------------------------------------------------------------
function fail(context, error) {
  console.error(`\n✗ ${context}:`, error.message ?? error);
  process.exit(1);
}

async function insertAll(table, rows, { returning } = {}) {
  if (rows.length === 0) return [];
  const CHUNK = 500;
  const inserted = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const query = supabase.from(table).insert(chunk);
    const { data, error } = returning ? await query.select(returning) : await query;
    if (error) fail(`Inserting into ${table}`, error);
    if (data) inserted.push(...data);
  }
  return inserted;
}

/**
 * Finds the demo user by email, creating it if it doesn't exist yet.
 *
 * The Admin API has no email filter on listUsers(), so this paginates and
 * matches by hand — the same approach lib/supabase/admin.ts already uses.
 *
 * When the user already exists, its password is reset to DEMO_PASSWORD
 * rather than left alone, so the credentials printed in README.md are always
 * the ones that actually work even if someone changed them.
 */
async function findOrCreateDemoUser() {
  const PER_PAGE = 200;
  const MAX_PAGES = 25;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) fail("Listing users", error);

    const existing = data.users.find((user) => user.email?.toLowerCase() === DEMO_EMAIL);
    if (existing) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (updateError) fail("Resetting the demo password", updateError);
      console.log(`  Found existing demo user (${existing.id}), password reset.`);
      return existing.id;
    }

    if (data.nextPage === null) break;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    // Confirmed up front so the account can log in immediately, and so it
    // doesn't depend on the project's "Confirm email" setting either way.
    email_confirm: true,
    user_metadata: { full_name: "Alex Rivera", is_demo: true },
  });
  if (error) fail("Creating the demo user", error);

  console.log(`  Created demo user (${data.user.id}).`);
  return data.user.id;
}

/**
 * Deletes every row the demo user owns.
 *
 * Order matters. workout_logs goes before programs because
 * workout_logs.program_day_id is ON DELETE SET NULL — dropping programs
 * first would orphan (not remove) the logs. exercise_logs, program_days,
 * program_exercises and coach_messages have no user_id of their own and are
 * removed by cascade from their parents.
 *
 * The auth user itself is kept: deleting it would work (everything cascades
 * from auth.users) but would mint a new user id on every run, and keeping
 * one stable id makes the account easier to inspect over time.
 */
async function wipeDemoData(userId) {
  const tables = [
    "coach_conversations", // cascades -> coach_messages
    "workout_logs", // cascades -> exercise_logs
    "programs", // cascades -> program_days -> program_exercises
    "weight_logs",
    "nutrition_logs",
    "weekly_checkins",
    "nutrition_targets",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) fail(`Clearing ${table}`, error);
  }
  console.log(`  Cleared ${tables.length} tables (plus cascades).`);
}

// -----------------------------------------------------------------------------
// Seeding
// -----------------------------------------------------------------------------

async function seedProfile(userId) {
  // Upsert rather than insert: handle_new_user() already created this row
  // when the auth user was created, and wipeDemoData deliberately leaves it
  // in place on re-runs.
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: "Alex Rivera",
    date_of_birth: "1993-04-12",
    sex: "male",
    height_cm: 178,
    baseline_weight_kg: START_WEIGHT,
    injury_notes:
      "Left shoulder gets cranky on deep dips — keeping range of motion shallow and stopping a rep short if it flares up.",
    activity_level: "moderately_active",
    goal: "recomp",
    units: "metric",
    updated_at: new Date().toISOString(),
  });
  if (error) fail("Seeding profile", error);
}

async function seedNutritionTargets(userId) {
  await insertAll(
    "nutrition_targets",
    NUTRITION_TARGETS.map((target) => ({
      user_id: userId,
      ...target,
      created_at: timestampAt(target.effective_date, 9),
    }))
  );
}

async function seedProgram(userId) {
  const [program] = await insertAll(
    "programs",
    [
      {
        user_id: userId,
        name: PROGRAM.name,
        description: PROGRAM.description,
        is_active: true,
        created_at: timestampAt(addDays(TODAY, -(DAYS - 1)), 8),
      },
    ],
    { returning: "id" }
  );

  const days = await insertAll(
    "program_days",
    PROGRAM.days.map((day) => ({
      program_id: program.id,
      day_order: day.day_order,
      name: day.name,
    })),
    { returning: "id, day_order" }
  );

  const dayIdByOrder = new Map(days.map((day) => [day.day_order, day.id]));

  const exerciseRows = [];
  for (const day of PROGRAM.days) {
    day.exercises.forEach((exercise, index) => {
      exerciseRows.push({
        program_day_id: dayIdByOrder.get(day.day_order),
        exercise_order: index + 1,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
      });
    });
  }

  const exercises = await insertAll("program_exercises", exerciseRows, {
    returning: "id, program_day_id, exercise_order",
  });

  // Index back to the plan so workout seeding can find "day 2, exercise 3".
  const exerciseIdByDayAndOrder = new Map(
    exercises.map((exercise) => [
      `${exercise.program_day_id}:${exercise.exercise_order}`,
      exercise.id,
    ])
  );

  return { programId: program.id, dayIdByOrder, exerciseIdByDayAndOrder };
}

async function seedWorkouts(userId, { dayIdByOrder, exerciseIdByDayAndOrder }) {
  const workoutRows = SESSIONS.map((session, index) => {
    const day = PROGRAM.days[session.dayIndex];
    return {
      user_id: userId,
      program_day_id: dayIdByOrder.get(day.day_order),
      log_date: session.date,
      performed_at: timestampAt(session.date, 18, 30),
      completed: session.completed,
      // The in-progress session has no duration yet — it hasn't finished.
      duration_minutes: session.completed ? Math.round(38 + session.progress * 14 + noise(6)) : null,
      notes: session.completed && index % 5 === 2 ? pick(WORKOUT_NOTES) : null,
      created_at: timestampAt(session.date, 18, 30),
    };
  });

  const workouts = await insertAll("workout_logs", workoutRows, {
    returning: "id, log_date",
  });
  const workoutIdByDate = new Map(workouts.map((workout) => [workout.log_date, workout.id]));

  const setRows = [];

  for (const session of SESSIONS) {
    const day = PROGRAM.days[session.dayIndex];
    const dayId = dayIdByOrder.get(day.day_order);
    const workoutId = workoutIdByDate.get(session.date);

    day.exercises.forEach((exercise, exerciseIndex) => {
      // The in-progress session is mid-workout: the first two exercises are
      // done, the third is partly logged, the rest are untouched. That's the
      // state the dashboard is designed around.
      let setsToLog = exercise.sets;
      if (!session.completed) {
        if (exerciseIndex < 2) setsToLog = exercise.sets;
        else if (exerciseIndex === 2) setsToLog = 1;
        else return;
      }

      const [low, high] = repBand(exercise.reps);
      const programExerciseId = exerciseIdByDayAndOrder.get(`${dayId}:${exerciseIndex + 1}`);

      for (let setNumber = 1; setNumber <= setsToLog; setNumber++) {
        // Reps climb across the 12 weeks from the bottom of the prescribed
        // band toward the top, and drop off slightly on later sets within a
        // session — which is what fatigue actually looks like in a log.
        const progressed = low + (high - low) * (session.progress * 0.92);
        const fatigue = (setNumber - 1) * 0.45;
        const reps = clamp(Math.round(progressed - fatigue + noise(0.9)), Math.max(1, low - 2), high + 1);

        setRows.push({
          workout_log_id: workoutId,
          program_exercise_id: programExerciseId,
          exercise_name: exercise.name,
          set_number: setNumber,
          reps_completed: reps,
          // Bodyweight program — no external load to record.
          weight_kg: null,
          // RPE only on the last set, which is the one worth rating.
          rpe: setNumber === setsToLog ? round(clamp(7 + session.progress * 1.4 + noise(0.5), 6, 10), 1) : null,
          notes: null,
          created_at: timestampAt(session.date, 18, 30 + setNumber),
        });
      }
    });
  }

  await insertAll("exercise_logs", setRows);
  return { workoutCount: workoutRows.length, setCount: setRows.length };
}

async function seedWeightLogs(userId) {
  const rows = [];
  for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
    const date = addDays(TODAY, -(DAYS - 1 - dayIndex));
    const daysFromToday = DAYS - 1 - dayIndex;

    // Miss the occasional morning, the way anyone does — but never in the
    // last week, since the dashboard's "current" and "7-day average" stat
    // cards read exactly that window.
    if (daysFromToday > 7 && random() < 0.09) continue;

    rows.push({
      user_id: userId,
      logged_date: date,
      weight_kg: weightForDay(dayIndex),
      notes: dayIndex % 19 === 5 ? pick(WEIGHT_NOTES) : null,
      created_at: timestampAt(date, 7, 15),
    });
  }
  await insertAll("weight_logs", rows);
  return rows;
}

async function seedNutritionLogs(userId) {
  const rows = [];
  for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
    const date = addDays(TODAY, -(DAYS - 1 - dayIndex));
    if (random() < 0.07) continue;

    const t = dayIndex / (DAYS - 1);
    // Targets changed 42 days ago (see NUTRITION_TARGETS) — intake follows.
    const calorieTarget = daysBetween(date, TODAY) > 42 ? 2600 : 2450;
    const proteinTarget = daysBetween(date, TODAY) > 42 ? 165 : 175;
    const isTrainingDay = SESSION_DATES.has(date);

    // Adherence tightens over the block: wide swings early, close to target
    // by the end. Training days run slightly higher, rest days lower.
    const spread = 300 - t * 150;
    const calories = Math.round(
      calorieTarget + (isTrainingDay ? 120 : -90) + noise(spread)
    );
    const protein = round(clamp(proteinTarget * (0.8 + 0.19 * t) + noise(14), 90, 220), 1);
    const fat = round(clamp(70 + noise(13), 45, 100), 1);
    const carbs = round(Math.max(80, (calories - protein * 4 - fat * 9) / 4), 1);

    rows.push({
      user_id: userId,
      logged_date: date,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      notes: dayIndex % 23 === 7 ? pick(NUTRITION_NOTES) : null,
      created_at: timestampAt(date, 21, 40),
    });
  }
  await insertAll("nutrition_logs", rows);
  return rows;
}

function daysBetween(fromKey, toKey) {
  return Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / 86400000);
}

async function seedWeeklyCheckins(userId, weightRows) {
  const rows = [];

  // The current week deliberately gets no check-in: it isn't over yet, and
  // leaving it blank means the Logs page's check-in form opens on an empty
  // week that a visitor can actually fill in.
  for (let weeksAgo = WEEKS - 1; weeksAgo >= 1; weeksAgo--) {
    const weekStart = addDays(CURRENT_WEEK_START, -7 * weeksAgo);
    const weekEnd = addDays(weekStart, 6);
    const checkin = CHECKINS[weeksAgo];

    const weekWeights = weightRows
      .filter((row) => row.logged_date >= weekStart && row.logged_date <= weekEnd)
      .map((row) => row.weight_kg);
    const avgWeight =
      weekWeights.length > 0
        ? round(weekWeights.reduce((sum, value) => sum + value, 0) / weekWeights.length, 2)
        : null;

    rows.push({
      user_id: userId,
      week_start_date: weekStart,
      // The Logs page writes these four plus notes. weight_kg, waist_cm and
      // adherence_pct are the superseded Stage 1 columns nothing writes to
      // anymore (see migration 0003) — left null to match the app exactly.
      sessions_completed: SESSIONS_PER_WEEK[weeksAgo],
      energy_rating: checkin.energy,
      sleep_rating: checkin.sleep,
      avg_weight_kg: avgWeight,
      notes: checkin.notes,
      created_at: timestampAt(weekEnd, 20),
    });
  }

  await insertAll("weekly_checkins", rows);
  return rows.length;
}

async function seedCoachConversations(userId) {
  let messageCount = 0;

  for (const conversation of CONVERSATIONS) {
    const date = addDays(TODAY, -conversation.daysAgo);
    const [created] = await insertAll(
      "coach_conversations",
      [
        {
          user_id: userId,
          title: conversation.title,
          created_at: timestampAt(date, 19, 5),
          updated_at: timestampAt(date, 19, 5 + conversation.messages.length * 2),
        },
      ],
      { returning: "id" }
    );

    await insertAll(
      "coach_messages",
      conversation.messages.map((message, index) => ({
        conversation_id: created.id,
        role: message.role,
        content: message.content,
        created_at: timestampAt(date, 19, 5 + index * 2),
      }))
    );
    messageCount += conversation.messages.length;
  }

  return { conversationCount: CONVERSATIONS.length, messageCount };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  console.log(`\nSeeding demo account ${DEMO_EMAIL}`);
  console.log(`Anchored to ${TODAY} (UTC), ${WEEKS} weeks of history.\n`);

  const userId = await findOrCreateDemoUser();

  console.log("Resetting existing demo data...");
  await wipeDemoData(userId);

  console.log("Seeding...");
  await seedProfile(userId);
  await seedNutritionTargets(userId);
  const program = await seedProgram(userId);
  const { workoutCount, setCount } = await seedWorkouts(userId, program);
  const weightRows = await seedWeightLogs(userId);
  const nutritionRows = await seedNutritionLogs(userId);
  const checkinCount = await seedWeeklyCheckins(userId, weightRows);
  const { conversationCount, messageCount } = await seedCoachConversations(userId);

  console.log(`
✓ Demo account ready.

  user id             ${userId}
  email               ${DEMO_EMAIL}
  password            ${DEMO_PASSWORD}

  profiles            1
  nutrition_targets   ${NUTRITION_TARGETS.length}
  programs            1
  program_days        ${PROGRAM.days.length}
  program_exercises   ${PROGRAM.days.reduce((sum, day) => sum + day.exercises.length, 0)}
  workout_logs        ${workoutCount} (${workoutCount - 1} completed, 1 in progress today)
  exercise_logs       ${setCount}
  weight_logs         ${weightRows.length}
  nutrition_logs      ${nutritionRows.length}
  weekly_checkins     ${checkinCount}
  coach_conversations ${conversationCount}
  coach_messages      ${messageCount}
`);
}

main().catch((error) => fail("Seeding", error));
