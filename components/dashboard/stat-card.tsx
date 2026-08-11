import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5">
        <span className="stat-label">{label}</span>
        {children ?? <span className="stat-value">{value}</span>}
        {hint && <span className="stat-caption">{hint}</span>}
      </CardContent>
    </Card>
  );
}
