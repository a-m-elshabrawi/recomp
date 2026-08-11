"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { movingAverage } from "@/lib/stats";
import { formatWeightKg } from "@/lib/units";
import { addDaysToKey, getTodayKey } from "@/lib/dashboard/schedule";
import { formatShortDate, tickIntervalFor } from "@/lib/progress/format";
import { chartTooltipStyle } from "@/lib/progress/chart-theme";
import type { WeightPoint } from "@/lib/progress/types";
import { RangeToggle, type ChartRange } from "@/components/progress/range-toggle";

const DEFAULT_RANGE_DAYS = 90;
const ROLLING_WINDOW_ENTRIES = 7;

export function WeightChartSection({ history }: { history: WeightPoint[] }) {
  const [range, setRange] = useState<ChartRange>("90d");

  const filtered = useMemo(() => {
    if (range === "all") return history;
    const cutoff = addDaysToKey(getTodayKey(), -(DEFAULT_RANGE_DAYS - 1));
    return history.filter((point) => point.logged_date >= cutoff);
  }, [history, range]);

  const chartData = useMemo(() => {
    const rollingAvg = movingAverage(
      filtered,
      ROLLING_WINDOW_ENTRIES,
      (point) => point.weight_kg
    );
    return filtered.map((point, index) => ({
      date: point.logged_date,
      weight: point.weight_kg,
      rollingAvg: rollingAvg[index],
    }));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-3">
      <RangeToggle value={range} onChange={setRange} />

      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No weight entries in this range yet.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                interval={tickIntervalFor(chartData.length)}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 12 }}
                domain={["dataMin - 2", "dataMax + 2"]}
                tickFormatter={(value: number) => value.toFixed(0)}
              />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value, name) => [
                  formatWeightKg(Number(value)),
                  name === "weight" ? "Weight" : `${ROLLING_WINDOW_ENTRIES}-entry avg`,
                ]}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                dot={chartData.length <= 30}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
