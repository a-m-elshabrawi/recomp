/**
 * Date, week-boundary, and streak logic for the dashboard.
 *
 * WEEK BOUNDARY: weeks run Monday through Sunday. "This week" always means
 * the Monday-to-Sunday range containing today. This is a deliberate choice
 * (confirmed with the user) over a Sunday-start week.
 *
 * "TODAY": computed from the server's local clock (`new Date()` at
 * request/action time), not the client browser's timezone. For a personal
 * app this is a reasonable simplification — it only matters right around
 * local midnight, when the server's day and the user's own local day might
 * briefly disagree. Revisit if that ever proves annoying in practice.
 */

// ---- Date-key helpers -------------------------------------------------
//
// Dates are represented as plain "YYYY-MM-DD" strings (matching Postgres
// `date` columns) everywhere possible, converting to a Date only to do
// day-of-week/day arithmetic. This avoids the classic bug where
// `new Date("2026-08-10")` parses as UTC midnight and can shift to the
// *previous* local day depending on the server's timezone offset — the
// constructor used in parseDateKey below (year, monthIndex, day) is a
// local-time construction, not a UTC string parse.

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export function addDaysToKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

// ---- Week boundary ------------------------------------------------------

/** Monday of the week containing `dateKey`, as a date key. */
export function getWeekStartKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Days to subtract to reach Monday: Sunday (0) needs 6, Monday (1) needs
  // 0, Tuesday (2) needs 1, etc.
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDaysToKey(dateKey, -daysSinceMonday);
}

// ---- Weekly session count --------------------------------------------------

export const SESSIONS_PER_WEEK_TARGET = 4;

/**
 * Counts completed sessions whose date falls within the Monday-Sunday week
 * starting at `weekStartKey`. Date keys are zero-padded "YYYY-MM-DD", so
 * plain string comparison is a valid (and simple) range check.
 */
function countSessionsInWeek(
  completedDateKeys: string[],
  weekStartKey: string
): number {
  const weekEndKey = addDaysToKey(weekStartKey, 6);
  return completedDateKeys.filter(
    (key) => key >= weekStartKey && key <= weekEndKey
  ).length;
}

/** "Sessions completed this week: X/4" stat. */
export function countSessionsThisWeek(
  completedDateKeys: string[],
  todayKey: string
): number {
  return countSessionsInWeek(completedDateKeys, getWeekStartKey(todayKey));
}

// ---- Streak ------------------------------------------------------------

/**
 * Consecutive-week streak of hitting the SESSIONS_PER_WEEK_TARGET.
 *
 * Rules (confirmed with the user, since this is the genuinely ambiguous
 * part of the spec):
 *  - A week "counts" once it has >= target completed sessions, whether or
 *    not the week has actually finished yet.
 *  - The CURRENT week gets "early credit": if it already has >= target
 *    sessions, it adds to the streak immediately. But if it doesn't have
 *    the target yet, that alone is NOT treated as a failure — the current
 *    week just isn't counted, and we look at fully-elapsed prior weeks
 *    instead. A week only ever breaks the streak once it has actually
 *    finished and fell short.
 *  - So: start from this week (bonus point if it already qualifies), then
 *    walk backward one full week at a time counting qualifying weeks, and
 *    stop at the first week (going backward) that did NOT reach the
 *    target.
 *
 * Example: 2 full prior qualifying weeks, then this week (Wednesday) has
 * only 1/4 so far -> streak is still 2 (this week isn't judged yet). If
 * this week then reaches 4/4, streak becomes 3 immediately. Next Monday,
 * if last week's now-finished tally was under 4, the streak resets to 0.
 */
export function computeStreak(
  completedDateKeys: string[],
  todayKey: string,
  target: number = SESSIONS_PER_WEEK_TARGET
): number {
  const currentWeekStart = getWeekStartKey(todayKey);
  let streak = 0;

  if (countSessionsInWeek(completedDateKeys, currentWeekStart) >= target) {
    streak += 1;
  }

  // Walk backward through fully-elapsed prior weeks.
  let weekCursor = addDaysToKey(currentWeekStart, -7);
  // Safety cap so a data anomaly can't spin this into an unbounded loop —
  // 5 years of weekly history is far more than this app will ever need.
  const MAX_WEEKS_TO_CHECK = 260;

  for (let i = 0; i < MAX_WEEKS_TO_CHECK; i++) {
    if (countSessionsInWeek(completedDateKeys, weekCursor) >= target) {
      streak += 1;
      weekCursor = addDaysToKey(weekCursor, -7);
    } else {
      break;
    }
  }

  return streak;
}

// ---- Default day selection ----------------------------------------------

export type ProgramDayRef = { id: string; day_order: number };

/**
 * Picks which program day the dashboard should default to.
 *
 * If the user already has a workout_logs row for today (in progress or
 * completed), we resume that day rather than recomputing a fresh
 * suggestion — otherwise re-opening the dashboard mid-workout would hide
 * the sets already logged under a different tab. Only when there's no
 * session for today yet do we fall back to "next day in sequence after
 * the last completed day" (wrapping from the last day back to the first),
 * defaulting to the first day if nothing has ever been completed.
 */
export function computeDefaultDayId(
  days: ProgramDayRef[],
  options: {
    todaysProgramDayId: string | null;
    lastCompletedProgramDayId: string | null;
  }
): string | null {
  if (days.length === 0) return null;

  const sortedDays = [...days].sort((a, b) => a.day_order - b.day_order);

  if (
    options.todaysProgramDayId &&
    sortedDays.some((d) => d.id === options.todaysProgramDayId)
  ) {
    return options.todaysProgramDayId;
  }

  const lastIndex = options.lastCompletedProgramDayId
    ? sortedDays.findIndex((d) => d.id === options.lastCompletedProgramDayId)
    : -1;

  if (lastIndex === -1) {
    return sortedDays[0].id;
  }

  const nextIndex = (lastIndex + 1) % sortedDays.length;
  return sortedDays[nextIndex].id;
}
