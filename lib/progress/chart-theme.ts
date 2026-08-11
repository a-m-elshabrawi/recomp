import type { CSSProperties } from "react";

/**
 * Recharts' <Tooltip> renders an unstyled white popup by default — spread
 * this onto every <Tooltip> in the app so it matches the dark "training
 * ledger" theme instead of flashing a jarring white box.
 */
export const chartTooltipStyle: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
  cursor: { stroke: string; strokeWidth: number };
} = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--popover-foreground)",
    fontSize: "0.8125rem",
    padding: "0.5rem 0.75rem",
  },
  labelStyle: {
    color: "var(--muted-foreground)",
    marginBottom: "0.25rem",
  },
  itemStyle: {
    color: "var(--popover-foreground)",
  },
  cursor: {
    stroke: "var(--steel-light)",
    strokeWidth: 1,
  },
};
