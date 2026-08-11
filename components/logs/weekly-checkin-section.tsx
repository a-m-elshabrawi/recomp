"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getWeekAverageWeight,
  upsertWeeklyCheckin,
} from "@/app/(app)/logs/actions";
import { getTodayKey, getWeekStartKey } from "@/lib/dashboard/schedule";
import { formatWeightKg } from "@/lib/units";
import type { WeeklyCheckinEntry } from "@/lib/logs/types";

const selectClassName =
  "h-11 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function WeeklyCheckinSection({
  history,
}: {
  history: WeeklyCheckinEntry[];
}) {
  const router = useRouter();
  const todayKey = getTodayKey();

  const [weekStartDate, setWeekStartDate] = useState(getWeekStartKey(todayKey));
  const [sessionsCompleted, setSessionsCompleted] = useState("");
  const [energyRating, setEnergyRating] = useState("");
  const [sleepRating, setSleepRating] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const [avgWeightKg, setAvgWeightKg] = useState<number | null>(null);
  const [avgLoading, setAvgLoading] = useState(true);

  // Recompute the read-only average weight whenever the selected week
  // changes, debounced slightly since typing/picking a date can fire
  // several changes in quick succession.
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      setAvgLoading(true);
      void (async () => {
        const result = await getWeekAverageWeight(weekStartDate);
        if (cancelled) return;

        if (result.ok) {
          setAvgWeightKg(result.data.avgWeightKg);
          // Snap the field to the actual Monday of that week, in case the
          // user picked a different day of the week.
          if (result.data.weekStartDate !== weekStartDate) {
            setWeekStartDate(result.data.weekStartDate);
          }
        }
        setAvgLoading(false);
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [weekStartDate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (sessionsCompleted === "" || energyRating === "" || sleepRating === "") {
      setStatus("error");
      setMessage("Fill in sessions completed, energy, and sleep.");
      return;
    }

    setStatus("saving");

    const result = await upsertWeeklyCheckin({
      weekStartDate,
      sessionsCompleted: Number(sessionsCompleted),
      energyRating: Number(energyRating),
      sleepRating: Number(sleepRating),
      notes: notes.trim() === "" ? null : notes.trim(),
    });

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage("Weekly check-in saved.");
    setAvgWeightKg(result.data.avgWeightKg);
    setNotes("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {message && (
          <Alert variant={status === "error" ? "destructive" : "default"}>
            {status === "success" && (
              <Check className="size-4 text-primary" />
            )}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="checkin-week">Week of</Label>
          <Input
            id="checkin-week"
            type="date"
            className="h-11"
            value={weekStartDate}
            max={todayKey}
            onChange={(event) => setWeekStartDate(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Automatically set to the Monday of the selected week.
          </p>
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Average weight this week
          </span>
          <p className="text-lg font-semibold tracking-tight">
            {avgLoading
              ? "Calculating..."
              : avgWeightKg !== null
                ? formatWeightKg(avgWeightKg)
                : "No weight data for this week"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-sessions">Sessions (0-4)</Label>
            <select
              id="checkin-sessions"
              className={selectClassName}
              value={sessionsCompleted}
              onChange={(event) => setSessionsCompleted(event.target.value)}
              required
            >
              <option value="" disabled>
                --
              </option>
              {[0, 1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-energy">Energy (1-5)</Label>
            <select
              id="checkin-energy"
              className={selectClassName}
              value={energyRating}
              onChange={(event) => setEnergyRating(event.target.value)}
              required
            >
              <option value="" disabled>
                --
              </option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="checkin-sleep">Sleep (1-5)</Label>
            <select
              id="checkin-sleep"
              className={selectClassName}
              value={sleepRating}
              onChange={(event) => setSleepRating(event.target.value)}
              required
            >
              <option value="" disabled>
                --
              </option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="checkin-notes">Notes (optional)</Label>
          <Input
            id="checkin-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={status === "saving"} className="mt-1">
          {status === "saving" ? "Saving..." : "Save check-in"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Recent check-ins
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No check-ins yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Week of {entry.week_start_date}
                  </span>
                  <span className="font-medium">
                    {entry.sessions_completed}/4 sessions
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Energy {entry.energy_rating}/5 &middot; Sleep{" "}
                  {entry.sleep_rating}/5 &middot;{" "}
                  {entry.avg_weight_kg !== null
                    ? formatWeightKg(entry.avg_weight_kg)
                    : "no weight data"}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
