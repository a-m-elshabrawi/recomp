import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The landing hero's signature visual: an oversized rack of load plates
 * that fill cobalt in a slow diagonal wave, echoing the app's in-product
 * "sessions this week" plate indicator (components/training-ledger/
 * barbell-plates.tsx) at ambient scale.
 *
 * Rendered as a single SVG (one <g> per plate) rather than many elements,
 * and driven entirely by CSS — the wave, the per-plate stagger, and the
 * static reduced-motion fallback all live in globals.css under the
 * `.plate-*` / `.plate-rack-*` rules. This stays a server component: no
 * JS, no client bundle cost for a purely decorative backdrop.
 */
const COLS = 8;
const ROWS = 6;
const STEP = 46; // grid pitch in SVG units
const DISC_RADIUS = 18;
const HUB_RADIUS = 5.5;

export function PlateRack({ className }: { className?: string }) {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = col * STEP + STEP / 2;
      const cy = row * STEP + STEP / 2;
      // Stagger primarily by column (left-to-right roll) with a slight row
      // offset so the leading edge reads as a diagonal rather than a flat
      // vertical bar sweeping across.
      const delay = col * 0.28 + row * 0.14;
      // Static composition for reduced motion: diagonal bands of filled
      // plates so the rack looks intentionally loaded, not half-empty.
      const lit = (row + col) % 5 < 2;
      cells.push(
        <g
          key={`${row}-${col}`}
          className={cn("plate-cell", lit && "plate-cell--lit")}
          style={{ "--plate-delay": `${delay}s` } as CSSProperties}
        >
          <circle className="plate-disc" cx={cx} cy={cy} r={DISC_RADIUS} />
          <circle className="plate-hub" cx={cx} cy={cy} r={HUB_RADIUS} />
        </g>
      );
    }
  }

  return (
    <div
      className={cn("plate-rack-drift", className)}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${COLS * STEP} ${ROWS * STEP}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        {cells}
      </svg>
    </div>
  );
}
