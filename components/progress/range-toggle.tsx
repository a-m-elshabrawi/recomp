"use client";

import { cn } from "@/lib/utils";

export type ChartRange = "90d" | "all";

export function RangeToggle({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (value: ChartRange) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("90d")}
        className={cn(
          "rounded px-2.5 py-1 font-medium transition-colors",
          value === "90d"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Last 90 days
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "rounded px-2.5 py-1 font-medium transition-colors",
          value === "all"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        All time
      </button>
    </div>
  );
}
