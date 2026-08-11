"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { upsertNutritionLog } from "@/app/(app)/logs/actions";
import { getTodayKey } from "@/lib/dashboard/schedule";
import type { NutritionLogEntry } from "@/lib/logs/types";

function parseNonNegative(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function NutritionLogSection({
  history,
}: {
  history: NutritionLogEntry[];
}) {
  const router = useRouter();
  const todayKey = getTodayKey();
  const [date, setDate] = useState(todayKey);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const caloriesValue = parseNonNegative(calories);
    const proteinValue = parseNonNegative(protein);
    const carbsValue = parseNonNegative(carbs);
    const fatValue = parseNonNegative(fat);

    if (
      caloriesValue === null ||
      proteinValue === null ||
      carbsValue === null ||
      fatValue === null
    ) {
      setStatus("error");
      setMessage("Calories and macros must all be filled in as zero or a positive number.");
      return;
    }

    setStatus("saving");

    const result = await upsertNutritionLog({
      loggedDate: date,
      calories: caloriesValue,
      proteinG: proteinValue,
      carbsG: carbsValue,
      fatG: fatValue,
      notes: notes.trim() === "" ? null : notes.trim(),
    });

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage("Nutrition log saved.");
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
          <Label htmlFor="nutrition-date">Date</Label>
          <Input
            id="nutrition-date"
            type="date"
            className="h-11"
            value={date}
            max={todayKey}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nutrition-calories">Calories</Label>
            <Input
              id="nutrition-calories"
              type="number"
              inputMode="numeric"
              min="0"
              className="h-11 text-base"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nutrition-protein">Protein (g)</Label>
            <Input
              id="nutrition-protein"
              type="number"
              inputMode="decimal"
              min="0"
              className="h-11 text-base"
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nutrition-carbs">Carbs (g)</Label>
            <Input
              id="nutrition-carbs"
              type="number"
              inputMode="decimal"
              min="0"
              className="h-11 text-base"
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nutrition-fat">Fat (g)</Label>
            <Input
              id="nutrition-fat"
              type="number"
              inputMode="decimal"
              min="0"
              className="h-11 text-base"
              value={fat}
              onChange={(event) => setFat(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nutrition-notes">Notes (optional)</Label>
          <Input
            id="nutrition-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={status === "saving"} className="mt-1">
          {status === "saving" ? "Saving..." : "Save nutrition log"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Recent entries
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No nutrition entries yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {entry.logged_date}
                  </span>
                  <span className="font-medium">{entry.calories} kcal</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  P {entry.protein_g}g &middot; C {entry.carbs_g}g &middot; F{" "}
                  {entry.fat_g}g
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
