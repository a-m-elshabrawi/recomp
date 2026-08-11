import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: 20,
  md: 30,
  lg: 44,
} as const;

export type BarbellPlatesSize = keyof typeof SIZE_MAP;

/**
 * The app's signature progress indicator: a row of weight plates that
 * fill in (steel outline -> solid cobalt) as sessions are completed,
 * standing in for "X/4" text or a generic progress bar anywhere session
 * progress is shown.
 *
 * `completed` can exceed `total` (workout_logs only constrains one row
 * per user per *day*, not per week — see components/progress/
 * consistency-section.tsx's original bar-chart version for the same
 * caveat) — in that case all `total` plates render filled and the extra
 * count shows as a small "+N" badge rather than drawing more plates than
 * the target.
 */
export function BarbellPlates({
  completed,
  total = 4,
  size = "md",
  className,
}: {
  completed: number;
  total?: number;
  size?: BarbellPlatesSize;
  className?: string;
}) {
  const dimension = SIZE_MAP[size];
  const filledCount = Math.max(0, Math.min(completed, total));
  const overflow = Math.max(0, completed - total);

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${completed} of ${total} sessions completed`}
    >
      {Array.from({ length: total }, (_, index) => (
        <Plate key={index} filled={index < filledCount} dimension={dimension} />
      ))}
      {overflow > 0 && (
        <span className="stat-caption font-display font-semibold text-cobalt">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function Plate({ filled, dimension }: { filled: boolean; dimension: number }) {
  const center = dimension / 2;
  const outerRadius = center - 1.5;
  const innerRadius = dimension * 0.24;

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox={`0 0 ${dimension} ${dimension}`}
      aria-hidden="true"
      className={cn(
        "motion-safe:transition-[fill,stroke] motion-safe:duration-300 motion-safe:ease-out",
        filled && "motion-safe:animate-[plate-fill_0.32s_ease-out]"
      )}
    >
      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill={filled ? "var(--cobalt)" : "transparent"}
        stroke={filled ? "var(--cobalt-dark)" : "var(--steel-light)"}
        strokeWidth={filled ? 1 : 1.5}
      />
      <circle
        cx={center}
        cy={center}
        r={innerRadius}
        fill="var(--ink)"
        stroke={filled ? "var(--cobalt-dark)" : "var(--steel-light)"}
        strokeWidth={1}
      />
    </svg>
  );
}
