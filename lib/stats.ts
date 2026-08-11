/** Arithmetic mean, or null for an empty list rather than dividing by zero. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Trailing N-entry moving average, for smoothing a noisy time series into
 * a trend line — one output value per input point, each the average of
 * that point and the (windowSize - 1) points before it.
 *
 * This windows by *entry count*, not by calendar time. That's a
 * deliberate, different choice from the dashboard's "current weight"
 * stat card (see average() usage in app/(app)/page.tsx), which averages
 * the last 7 *calendar days* ending today — a single snapshot answering
 * "what's my weight right now." This function instead answers "what's
 * the trend across my last N logged entries," which stays well-defined
 * even when logging is irregular (e.g. weighing in every 2-3 days rather
 * than daily) — a calendar-day window can end up empty or wildly
 * under-sampled in that case, while an entry-count window can't. Both
 * share the same underlying average() so the arithmetic itself never
 * diverges between the two.
 */
export function movingAverage<T>(
  points: T[],
  windowSize: number,
  getValue: (point: T) => number
): (number | null)[] {
  return points.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = points.slice(start, index + 1).map(getValue);
    return average(window);
  });
}
