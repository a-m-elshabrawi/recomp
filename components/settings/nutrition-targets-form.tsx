"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateNutritionTargets } from "@/app/(app)/settings/actions";

type InitialTargets = {
  maintenance_kcal: number | null;
  calories_target: number;
  protein_target_g: number;
  fat_target_g: number;
  carbs_target_g: number;
} | null;

function parseNonNegative(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function NutritionTargetsForm({
  initialTargets,
}: {
  initialTargets: InitialTargets;
}) {
  const router = useRouter();
  const [maintenanceKcal, setMaintenanceKcal] = useState(
    initialTargets?.maintenance_kcal != null
      ? String(initialTargets.maintenance_kcal)
      : ""
  );
  const [caloriesTarget, setCaloriesTarget] = useState(
    initialTargets ? String(initialTargets.calories_target) : ""
  );
  const [proteinTargetG, setProteinTargetG] = useState(
    initialTargets ? String(initialTargets.protein_target_g) : ""
  );
  const [fatTargetG, setFatTargetG] = useState(
    initialTargets ? String(initialTargets.fat_target_g) : ""
  );
  const [carbsTargetG, setCarbsTargetG] = useState(
    initialTargets ? String(initialTargets.carbs_target_g) : ""
  );

  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const maintenanceValue = parseNonNegative(maintenanceKcal);
    const caloriesValue = parseNonNegative(caloriesTarget);
    const proteinValue = parseNonNegative(proteinTargetG);
    const fatValue = parseNonNegative(fatTargetG);
    const carbsValue = parseNonNegative(carbsTargetG);

    if (
      maintenanceValue === null ||
      caloriesValue === null ||
      proteinValue === null ||
      fatValue === null ||
      carbsValue === null
    ) {
      setStatus("error");
      setMessage(
        "All fields must be filled in as zero or a positive number."
      );
      return;
    }

    setStatus("saving");

    const result = await updateNutritionTargets({
      maintenanceKcal: maintenanceValue,
      caloriesTarget: caloriesValue,
      proteinTargetG: proteinValue,
      fatTargetG: fatValue,
      carbsTargetG: carbsValue,
    });

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage("Nutrition targets saved.");
    router.refresh();
  }

  return (
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
          <Label htmlFor="targets-maintenance">Maintenance (kcal/day)</Label>
          <Input
            id="targets-maintenance"
            type="number"
            inputMode="numeric"
            min="0"
            className="h-11 text-base"
            value={maintenanceKcal}
            onChange={(event) => setMaintenanceKcal(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targets-calories">Target (kcal/day)</Label>
          <Input
            id="targets-calories"
            type="number"
            inputMode="numeric"
            min="0"
            className="h-11 text-base"
            value={caloriesTarget}
            onChange={(event) => setCaloriesTarget(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="targets-protein">Protein (g)</Label>
          <Input
            id="targets-protein"
            type="number"
            inputMode="numeric"
            min="0"
            className="h-11 text-base"
            value={proteinTargetG}
            onChange={(event) => setProteinTargetG(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targets-fat">Fat (g)</Label>
          <Input
            id="targets-fat"
            type="number"
            inputMode="numeric"
            min="0"
            className="h-11 text-base"
            value={fatTargetG}
            onChange={(event) => setFatTargetG(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targets-carbs">Carbs (g)</Label>
          <Input
            id="targets-carbs"
            type="number"
            inputMode="numeric"
            min="0"
            className="h-11 text-base"
            value={carbsTargetG}
            onChange={(event) => setCarbsTargetG(event.target.value)}
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={status === "saving"}
        className="mt-1 self-start"
      >
        {status === "saving" ? "Saving..." : "Save nutrition targets"}
      </Button>
    </form>
  );
}
