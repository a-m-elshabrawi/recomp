"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateProfile } from "@/app/(app)/settings/actions";

const selectClassName =
  "h-11 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type InitialProfile = {
  sex: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  baseline_weight_kg: number | null;
  activity_level: string | null;
  injury_notes: string | null;
} | null;

export function ProfileForm({
  initialProfile,
}: {
  initialProfile: InitialProfile;
}) {
  const router = useRouter();
  const [sex, setSex] = useState(initialProfile?.sex ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    initialProfile?.date_of_birth ?? ""
  );
  const [heightCm, setHeightCm] = useState(
    initialProfile?.height_cm != null ? String(initialProfile.height_cm) : ""
  );
  const [baselineWeightKg, setBaselineWeightKg] = useState(
    initialProfile?.baseline_weight_kg != null
      ? String(initialProfile.baseline_weight_kg)
      : ""
  );
  const [activityLevel, setActivityLevel] = useState(
    initialProfile?.activity_level ?? ""
  );
  const [injuryNotes, setInjuryNotes] = useState(
    initialProfile?.injury_notes ?? ""
  );

  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const heightValue = heightCm.trim() === "" ? null : Number(heightCm);
    const weightValue =
      baselineWeightKg.trim() === "" ? null : Number(baselineWeightKg);

    if (
      (heightValue !== null && !Number.isFinite(heightValue)) ||
      (weightValue !== null && !Number.isFinite(weightValue))
    ) {
      setStatus("error");
      setMessage("Height and weight must be numbers.");
      return;
    }

    setStatus("saving");

    const result = await updateProfile({
      sex: sex === "" ? null : sex,
      dateOfBirth: dateOfBirth === "" ? null : dateOfBirth,
      heightCm: heightValue,
      baselineWeightKg: weightValue,
      activityLevel: activityLevel === "" ? null : activityLevel,
      injuryNotes: injuryNotes.trim() === "" ? null : injuryNotes.trim(),
    });

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage("Profile saved.");
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
          <Label htmlFor="profile-sex">Sex</Label>
          <select
            id="profile-sex"
            className={selectClassName}
            value={sex}
            onChange={(event) => setSex(event.target.value)}
          >
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-dob">Date of birth</Label>
          <Input
            id="profile-dob"
            type="date"
            className="h-11"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-height">Height (cm)</Label>
          <Input
            id="profile-height"
            type="number"
            inputMode="decimal"
            min="0"
            className="h-11 text-base"
            value={heightCm}
            onChange={(event) => setHeightCm(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-weight">Baseline weight (kg)</Label>
          <Input
            id="profile-weight"
            type="number"
            inputMode="decimal"
            min="0"
            className="h-11 text-base"
            value={baselineWeightKg}
            onChange={(event) => setBaselineWeightKg(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-activity">Activity level</Label>
        <select
          id="profile-activity"
          className={selectClassName}
          value={activityLevel}
          onChange={(event) => setActivityLevel(event.target.value)}
        >
          <option value="">Not set</option>
          <option value="sedentary">Sedentary</option>
          <option value="lightly_active">Lightly active</option>
          <option value="moderately_active">Moderately active</option>
          <option value="very_active">Very active</option>
          <option value="extremely_active">Extremely active</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-injury-notes">Injury notes</Label>
        <Textarea
          id="profile-injury-notes"
          value={injuryNotes}
          onChange={(event) => setInjuryNotes(event.target.value)}
          placeholder="Anything your coach should know about — old injuries, movements to avoid, etc."
          rows={3}
        />
      </div>

      <Button
        type="submit"
        disabled={status === "saving"}
        className="mt-1 self-start"
      >
        {status === "saving" ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
