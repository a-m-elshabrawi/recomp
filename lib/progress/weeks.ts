import { addDaysToKey, getWeekStartKey } from "@/lib/dashboard/schedule";
import type { WeeklySessionCount } from "@/lib/progress/types";

/**
 * The last `count` Monday-start week-keys, oldest first, ending at (and
 * including) the current week — a continuous timeline with no gaps, so
 * weeks with zero sessions still show up as an empty bar rather than
 * being skipped.
 */
export function getRecentWeekStartKeys(todayKey: string, count: number): string[] {
  const currentWeekStart = getWeekStartKey(todayKey);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(addDaysToKey(currentWeekStart, -7 * i));
  }
  return keys;
}

/** Counts how many completed-session date keys fall into each given week. */
export function countSessionsPerWeek(
  completedDateKeys: string[],
  weekStartKeys: string[]
): WeeklySessionCount[] {
  return weekStartKeys.map((weekStartDate) => {
    const weekEndDate = addDaysToKey(weekStartDate, 6);
    const count = completedDateKeys.filter(
      (key) => key >= weekStartDate && key <= weekEndDate
    ).length;
    return { weekStartDate, count };
  });
}
