"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { addDaysToKey, getWeekStartKey } from "@/lib/dashboard/schedule";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---- Weight ---------------------------------------------------------------

export type UpsertWeightLogInput = {
  loggedDate: string;
  weightKg: number;
  notes: string | null;
};

const MAX_WEIGHT_KG = 500;

export async function upsertWeightLog(
  input: UpsertWeightLogInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return { ok: false, error: "Weight must be a positive number." };
  }
  if (input.weightKg > MAX_WEIGHT_KG) {
    return { ok: false, error: `Weight must be ${MAX_WEIGHT_KG}kg or less.` };
  }

  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: user.id,
        logged_date: input.loggedDate,
        weight_kg: input.weightKg,
        notes: input.notes,
      },
      { onConflict: "user_id,logged_date" }
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/logs");
  return { ok: true, data: { id: data.id } };
}

// ---- Nutrition --------------------------------------------------------------

export type UpsertNutritionLogInput = {
  loggedDate: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string | null;
};

export async function upsertNutritionLog(
  input: UpsertNutritionLogInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const numericFields = [
    input.calories,
    input.proteinG,
    input.carbsG,
    input.fatG,
  ];
  if (numericFields.some((value) => !Number.isFinite(value) || value < 0)) {
    return {
      ok: false,
      error: "Calories and macros must be zero or a positive number.",
    };
  }

  const { data, error } = await supabase
    .from("nutrition_logs")
    .upsert(
      {
        user_id: user.id,
        logged_date: input.loggedDate,
        calories: input.calories,
        protein_g: input.proteinG,
        carbs_g: input.carbsG,
        fat_g: input.fatG,
        notes: input.notes,
      },
      { onConflict: "user_id,logged_date" }
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/logs");
  return { ok: true, data: { id: data.id } };
}

// ---- Weekly check-in --------------------------------------------------------

/**
 * Average weight_kg from weight_logs within the Monday-Sunday week
 * starting at weekStartDate (same week-boundary convention as the
 * dashboard — see lib/dashboard/schedule.ts). Returns null if there's no
 * weight data for that week, rather than dividing by zero.
 */
async function computeWeekAverageWeightKg(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string
): Promise<number | null> {
  const weekEndDate = addDaysToKey(weekStartDate, 6);

  const { data, error } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", userId)
    .gte("logged_date", weekStartDate)
    .lte("logged_date", weekEndDate);

  if (error || !data || data.length === 0) {
    return null;
  }

  const sum = data.reduce((total, row) => total + (row.weight_kg as number), 0);
  return sum / data.length;
}

/**
 * Live preview for the weekly check-in form: recomputed whenever the user
 * changes the week's date, before they submit anything.
 */
export async function getWeekAverageWeight(
  weekStartDate: string
): Promise<ActionResult<{ avgWeightKg: number | null; weekStartDate: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const normalizedWeekStart = getWeekStartKey(weekStartDate);
  const avgWeightKg = await computeWeekAverageWeightKg(
    supabase,
    user.id,
    normalizedWeekStart
  );

  return { ok: true, data: { avgWeightKg, weekStartDate: normalizedWeekStart } };
}

export type UpsertWeeklyCheckinInput = {
  weekStartDate: string;
  sessionsCompleted: number;
  energyRating: number;
  sleepRating: number;
  notes: string | null;
};

export async function upsertWeeklyCheckin(
  input: UpsertWeeklyCheckinInput
): Promise<
  ActionResult<{ id: string; avgWeightKg: number | null; weekStartDate: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (
    !Number.isInteger(input.sessionsCompleted) ||
    input.sessionsCompleted < 0 ||
    input.sessionsCompleted > 4
  ) {
    return { ok: false, error: "Sessions completed must be between 0 and 4." };
  }
  if (
    !Number.isInteger(input.energyRating) ||
    input.energyRating < 1 ||
    input.energyRating > 5
  ) {
    return { ok: false, error: "Energy rating must be between 1 and 5." };
  }
  if (
    !Number.isInteger(input.sleepRating) ||
    input.sleepRating < 1 ||
    input.sleepRating > 5
  ) {
    return { ok: false, error: "Sleep rating must be between 1 and 5." };
  }

  // Never trust a client-supplied average — recompute server-side from the
  // same data the live preview used, normalizing to that week's Monday
  // regardless of exactly which date within the week was picked.
  const normalizedWeekStart = getWeekStartKey(input.weekStartDate);
  const avgWeightKg = await computeWeekAverageWeightKg(
    supabase,
    user.id,
    normalizedWeekStart
  );

  const { data, error } = await supabase
    .from("weekly_checkins")
    .upsert(
      {
        user_id: user.id,
        week_start_date: normalizedWeekStart,
        sessions_completed: input.sessionsCompleted,
        energy_rating: input.energyRating,
        sleep_rating: input.sleepRating,
        avg_weight_kg: avgWeightKg,
        notes: input.notes,
      },
      { onConflict: "user_id,week_start_date" }
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/logs");
  return {
    ok: true,
    data: { id: data.id, avgWeightKg, weekStartDate: normalizedWeekStart },
  };
}
