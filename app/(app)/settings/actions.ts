"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTodayKey } from "@/lib/dashboard/schedule";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SEX_VALUES = ["male", "female", "other"] as const;
const ACTIVITY_LEVEL_VALUES = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extremely_active",
] as const;

const MAX_HEIGHT_CM = 250;
const MIN_HEIGHT_CM = 50;
const MAX_WEIGHT_KG = 500;
const MIN_WEIGHT_KG = 20;
const MAX_INJURY_NOTES_LENGTH = 2000;
const MAX_AGE_YEARS = 120;

export type UpdateProfileInput = {
  sex: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  baselineWeightKg: number | null;
  activityLevel: string | null;
  injuryNotes: string | null;
};

export async function updateProfile(
  input: UpdateProfileInput
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.sex !== null && !SEX_VALUES.includes(input.sex as (typeof SEX_VALUES)[number])) {
    return { ok: false, error: "Invalid sex value." };
  }

  if (
    input.activityLevel !== null &&
    !ACTIVITY_LEVEL_VALUES.includes(
      input.activityLevel as (typeof ACTIVITY_LEVEL_VALUES)[number]
    )
  ) {
    return { ok: false, error: "Invalid activity level." };
  }

  if (input.dateOfBirth !== null) {
    const todayKey = getTodayKey();
    if (input.dateOfBirth > todayKey) {
      return { ok: false, error: "Date of birth can't be in the future." };
    }
    const [year] = input.dateOfBirth.split("-").map(Number);
    const currentYear = Number(todayKey.split("-")[0]);
    if (!year || currentYear - year > MAX_AGE_YEARS) {
      return { ok: false, error: "That date of birth doesn't look right." };
    }
  }

  if (
    input.heightCm !== null &&
    (!Number.isFinite(input.heightCm) ||
      input.heightCm < MIN_HEIGHT_CM ||
      input.heightCm > MAX_HEIGHT_CM)
  ) {
    return {
      ok: false,
      error: `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`,
    };
  }

  if (
    input.baselineWeightKg !== null &&
    (!Number.isFinite(input.baselineWeightKg) ||
      input.baselineWeightKg < MIN_WEIGHT_KG ||
      input.baselineWeightKg > MAX_WEIGHT_KG)
  ) {
    return {
      ok: false,
      error: `Baseline weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`,
    };
  }

  if (
    input.injuryNotes !== null &&
    input.injuryNotes.length > MAX_INJURY_NOTES_LENGTH
  ) {
    return {
      ok: false,
      error: `Injury notes must be ${MAX_INJURY_NOTES_LENGTH} characters or fewer.`,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      sex: input.sex,
      date_of_birth: input.dateOfBirth,
      height_cm: input.heightCm,
      baseline_weight_kg: input.baselineWeightKg,
      activity_level: input.activityLevel,
      injury_notes: input.injuryNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/coach");
  revalidatePath("/");
  return { ok: true, data: null };
}

export type UpdateNutritionTargetsInput = {
  maintenanceKcal: number;
  caloriesTarget: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbsTargetG: number;
};

/**
 * nutrition_targets is a history table (only one row per user has
 * is_active = true at a time — see supabase/schema.sql). Saving from
 * Settings preserves that: if today already has an active row (the user
 * already edited once today), it's updated in place; otherwise the
 * current active row is closed out and a new one opens today, so the
 * history of *when* targets changed stays intact.
 */
export async function updateNutritionTargets(
  input: UpdateNutritionTargetsInput
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const positiveFields: [number, string][] = [
    [input.maintenanceKcal, "Maintenance calories"],
    [input.caloriesTarget, "Calorie target"],
  ];
  for (const [value, label] of positiveFields) {
    if (!Number.isFinite(value) || value <= 0 || value > 10000) {
      return {
        ok: false,
        error: `${label} must be a positive number (up to 10,000).`,
      };
    }
  }

  const nonNegativeFields: [number, string][] = [
    [input.proteinTargetG, "Protein target"],
    [input.fatTargetG, "Fat target"],
    [input.carbsTargetG, "Carb target"],
  ];
  for (const [value, label] of nonNegativeFields) {
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      return {
        ok: false,
        error: `${label} must be zero or a positive number (up to 1,000g).`,
      };
    }
  }

  const todayKey = getTodayKey();

  const { data: activeRow, error: findError } = await supabase
    .from("nutrition_targets")
    .select("id, effective_date")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };

  const fields = {
    maintenance_kcal: input.maintenanceKcal,
    calories_target: input.caloriesTarget,
    protein_target_g: input.proteinTargetG,
    fat_target_g: input.fatTargetG,
    carbs_target_g: input.carbsTargetG,
  };

  if (activeRow && activeRow.effective_date === todayKey) {
    const { error } = await supabase
      .from("nutrition_targets")
      .update(fields)
      .eq("id", activeRow.id);
    if (error) return { ok: false, error: error.message };
  } else {
    if (activeRow) {
      const { error: closeError } = await supabase
        .from("nutrition_targets")
        .update({ is_active: false })
        .eq("id", activeRow.id);
      if (closeError) return { ok: false, error: closeError.message };
    }

    const { error: insertError } = await supabase
      .from("nutrition_targets")
      .insert({
        user_id: user.id,
        ...fields,
        effective_date: todayKey,
        is_active: true,
      });
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/progress");
  revalidatePath("/coach");
  return { ok: true, data: null };
}
