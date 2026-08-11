"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getExerciseProgressLogs } from "@/app/(app)/progress/actions";
import { formatShortDate, tickIntervalFor } from "@/lib/progress/format";
import { chartTooltipStyle } from "@/lib/progress/chart-theme";
import type {
  ExerciseOption,
  ExerciseProgressPoint,
} from "@/lib/progress/types";

const selectClassName =
  "h-11 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Representation choice: one line, "average reps per session" — for each
 * workout the exercise appears in, the mean of reps_completed across
 * whichever sets were actually logged that day.
 *
 * The alternative (one line per set_number) was rejected because sets
 * aren't always logged consistently — a user might log 3 of 4 target
 * sets some sessions, or add an extra set on a good day — which would
 * leave per-set lines full of gaps and make direct comparisons between
 * "Set 3" points misleading (they wouldn't reliably represent the same
 * position in the workout). Averaging per session stays well-defined
 * regardless of exactly how many sets got logged, and still answers the
 * core question — "am I doing more reps for this exercise over time?" —
 * in one readable line.
 */
export function StrengthSection({
  exercises,
}: {
  exercises: ExerciseOption[];
}) {
  const [selectedId, setSelectedId] = useState(exercises[0]?.id ?? "");
  const [points, setPoints] = useState<ExerciseProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    // Deferred via setTimeout(..., 0) so the loading-state update doesn't
    // happen synchronously within the effect body itself.
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        const result = await getExerciseProgressLogs(selectedId);
        if (cancelled) return;
        setPoints(result.ok ? result.data : []);
        setLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedId]);

  if (exercises.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No exercises found in your active program.
      </div>
    );
  }

  const groupedByDay = new Map<string, ExerciseOption[]>();
  for (const exercise of exercises) {
    const group = groupedByDay.get(exercise.dayName) ?? [];
    group.push(exercise);
    groupedByDay.set(exercise.dayName, group);
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        className={selectClassName}
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        aria-label="Select an exercise"
      >
        {Array.from(groupedByDay.entries()).map(([dayName, dayExercises]) => (
          <optgroup key={dayName} label={dayName}>
            {dayExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Loading...
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No logs yet for this exercise.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                interval={tickIntervalFor(points.length)}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                width={32}
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                domain={[0, "dataMax + 2"]}
              />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => [
                  `${Number(value).toFixed(1)} reps`,
                  "Avg reps",
                ]}
              />
              <Line
                type="monotone"
                dataKey="avgReps"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={points.length <= 30}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
