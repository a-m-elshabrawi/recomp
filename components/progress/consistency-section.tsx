import { SESSIONS_PER_WEEK_TARGET } from "@/lib/dashboard/schedule";
import { formatWeekRange } from "@/lib/progress/format";
import type { WeeklySessionCount } from "@/lib/progress/types";
import { BarbellPlates } from "@/components/training-ledger/barbell-plates";

/**
 * A logbook list rather than a chart: each row is one week, "Week of ..."
 * plus that week's BarbellPlates — this is the same signature component
 * used for the dashboard's weekly stat, so consistency reads the same way
 * everywhere in the app rather than as a separate chart idiom. No client
 * JS needed here (no chart library, no interactivity), so this stays a
 * plain server-renderable component.
 */
export function ConsistencySection({
  weeklyCounts,
}: {
  weeklyCounts: WeeklySessionCount[];
}) {
  const hasAnyData = weeklyCounts.some((week) => week.count > 0);

  if (!hasAnyData) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No completed sessions in the last {weeklyCounts.length} weeks yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border">
      {weeklyCounts.map((week) => (
        <div
          key={week.weekStartDate}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <span className="text-sm text-muted-foreground">
            Week of {formatWeekRange(week.weekStartDate)}
          </span>
          <BarbellPlates
            completed={week.count}
            total={SESSIONS_PER_WEEK_TARGET}
            size="md"
          />
        </div>
      ))}
    </div>
  );
}
