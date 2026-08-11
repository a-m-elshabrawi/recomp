"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDaysToKey, getTodayKey } from "@/lib/dashboard/schedule";
import { formatShortDate, tickIntervalFor } from "@/lib/progress/format";
import { chartTooltipStyle } from "@/lib/progress/chart-theme";
import type { NutritionPoint, NutritionTargets } from "@/lib/progress/types";
import { RangeToggle, type ChartRange } from "@/components/progress/range-toggle";

const DEFAULT_RANGE_DAYS = 90;

// Two small charts rather than one dual-line chart: calories (roughly
// 1500-3000) and protein (roughly 50-250g) sit on very different scales,
// so sharing one Y-axis would flatten protein into a nearly straight
// line. Separate charts each get an axis scaled to their own data, and
// each can show its own target as a ReferenceLine without the two
// targets visually colliding.
export function NutritionTrendsSection({
  history,
  targets,
}: {
  history: NutritionPoint[];
  targets: NutritionTargets;
}) {
  const [range, setRange] = useState<ChartRange>("90d");

  const filtered = useMemo(() => {
    if (range === "all") return history;
    const cutoff = addDaysToKey(getTodayKey(), -(DEFAULT_RANGE_DAYS - 1));
    return history.filter((point) => point.logged_date >= cutoff);
  }, [history, range]);

  return (
    <div className="flex flex-col gap-4">
      <RangeToggle value={range} onChange={setRange} />

      {filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No nutrition entries in this range yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NutritionMiniChart
            title="Calories"
            data={filtered}
            dataKey="calories"
            target={targets.caloriesTarget}
            unit="kcal"
            color="var(--chart-2)"
          />
          <NutritionMiniChart
            title="Protein"
            data={filtered}
            dataKey="protein_g"
            target={targets.proteinTargetG}
            unit="g"
            color="var(--chart-4)"
          />
        </div>
      )}
    </div>
  );
}

function NutritionMiniChart({
  title,
  data,
  dataKey,
  target,
  unit,
  color,
}: {
  title: string;
  data: NutritionPoint[];
  dataKey: "calories" | "protein_g";
  target: number | null;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="logged_date"
              tickFormatter={formatShortDate}
              interval={tickIntervalFor(data.length, 4)}
              tick={{ fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              width={40}
              tick={{ fontSize: 11 }}
              domain={[0, "dataMax + 10"]}
            />
            <Tooltip
              {...chartTooltipStyle}
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(value) => [`${value} ${unit}`, title]}
            />
            {target !== null && (
              <ReferenceLine
                y={target}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: `Target ${target}${unit === "kcal" ? "" : "g"}`,
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  position: "insideTopRight",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={data.length <= 30}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
