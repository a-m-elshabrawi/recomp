/** "YYYY-MM-DD" -> "Jan 5", for compact chart axis ticks and tooltips. */
export function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Picks an XAxis `interval` that keeps roughly `targetTicks` labels visible regardless of series length. */
export function tickIntervalFor(pointCount: number, targetTicks: number = 6): number {
  return Math.max(0, Math.ceil(pointCount / targetTicks) - 1);
}

/** "YYYY-MM-DD" week-start key -> "Aug 4 – 10" (Monday through Sunday). */
export function formatWeekRange(weekStartKey: string): string {
  const [year, month, day] = weekStartKey.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}
