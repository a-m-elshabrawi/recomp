"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { upsertWeightLog } from "@/app/(app)/logs/actions";
import { getTodayKey } from "@/lib/dashboard/schedule";
import { formatWeightKg } from "@/lib/units";
import type { WeightLogEntry } from "@/lib/logs/types";

export function WeightLogSection({ history }: { history: WeightLogEntry[] }) {
  const router = useRouter();
  const todayKey = getTodayKey();
  const [date, setDate] = useState(todayKey);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const weightValue = Number(weight);
    if (weight.trim() === "" || !Number.isFinite(weightValue)) {
      setStatus("error");
      setMessage("Enter a weight.");
      return;
    }

    setStatus("saving");

    const result = await upsertWeightLog({
      loggedDate: date,
      weightKg: weightValue,
      notes: notes.trim() === "" ? null : notes.trim(),
    });

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage("Weight saved.");
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-date">Date</Label>
            <Input
              id="weight-date"
              type="date"
              className="h-11"
              value={date}
              max={todayKey}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-value">Weight (kg)</Label>
            <Input
              id="weight-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="h-11 text-base"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="weight-notes">Notes (optional)</Label>
          <Input
            id="weight-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={status === "saving"} className="mt-1">
          {status === "saving" ? "Saving..." : "Save weight"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Recent entries
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No weight entries yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {entry.logged_date}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatWeightKg(entry.weight_kg)}
                  </span>
                  {entry.notes && (
                    <span className="max-w-[16ch] truncate text-xs text-muted-foreground">
                      {entry.notes}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
