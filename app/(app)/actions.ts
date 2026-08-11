"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getTodayKey } from "@/lib/dashboard/schedule";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Finds today's workout_logs row for this user, creating it if it doesn't
 * exist yet (first set logged today, or "mark complete" pressed with
 * nothing logged yet). If a row already exists but was created under a
 * different program_day_id (the user switched the day selector after
 * starting), keeps it in sync with whichever day is currently selected —
 * there is exactly one workout_logs row per user per calendar day.
 */
async function findOrCreateTodaysWorkoutLog(
  supabase: SupabaseClient,
  userId: string,
  programDayId: string
): Promise<ActionResult<string>> {
  const todayKey = getTodayKey();

  const { data: existing, error: findError } = await supabase
    .from("workout_logs")
    .select("id, program_day_id")
    .eq("user_id", userId)
    .eq("log_date", todayKey)
    .maybeSingle();

  if (findError) {
    return { ok: false, error: findError.message };
  }

  if (existing) {
    if (existing.program_day_id !== programDayId) {
      const { error: updateError } = await supabase
        .from("workout_logs")
        .update({ program_day_id: programDayId })
        .eq("id", existing.id);
      if (updateError) {
        return { ok: false, error: updateError.message };
      }
    }
    return { ok: true, data: existing.id as string };
  }

  const { data: created, error: createError } = await supabase
    .from("workout_logs")
    .insert({
      user_id: userId,
      program_day_id: programDayId,
      log_date: todayKey,
    })
    .select("id")
    .single();

  if (createError) {
    return { ok: false, error: createError.message };
  }

  return { ok: true, data: created.id as string };
}

export type LogSetInput = {
  programDayId: string;
  programExerciseId: string;
  exerciseName: string;
  setNumber: number;
  repsCompleted: number | null;
  notes: string | null;
};

export type LogSetData = {
  workoutLogId: string;
  exerciseLogId: string;
};

/**
 * Creates or updates a single set's log entry. Writes to exercise_logs are
 * upserted on (workout_log_id, program_exercise_id, set_number) — see
 * supabase/migrations/0001_stage3_dashboard.sql — so correcting a
 * mis-entered rep count updates the existing row instead of duplicating
 * it.
 */
export async function logSet(
  input: LogSetInput
): Promise<ActionResult<LogSetData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  // Defense in depth: the UI already strips non-digit characters and the
  // DB has a CHECK constraint (migration 0002), but never trust the client
  // — reject bad values here too rather than letting a malformed request
  // reach the database.
  if (
    input.repsCompleted !== null &&
    (!Number.isInteger(input.repsCompleted) || input.repsCompleted < 0)
  ) {
    return { ok: false, error: "Reps must be a non-negative whole number." };
  }

  const workoutLog = await findOrCreateTodaysWorkoutLog(
    supabase,
    user.id,
    input.programDayId
  );
  if (!workoutLog.ok) return workoutLog;

  const { data: upserted, error: upsertError } = await supabase
    .from("exercise_logs")
    .upsert(
      {
        workout_log_id: workoutLog.data,
        program_exercise_id: input.programExerciseId,
        exercise_name: input.exerciseName,
        set_number: input.setNumber,
        reps_completed: input.repsCompleted,
        notes: input.notes,
      },
      { onConflict: "workout_log_id,program_exercise_id,set_number" }
    )
    .select("id")
    .single();

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  return {
    ok: true,
    data: { workoutLogId: workoutLog.data, exerciseLogId: upserted.id },
  };
}

export type SetSessionCompletedInput = {
  workoutLogId: string | null;
  programDayId: string;
  completed: boolean;
};

/**
 * Toggles today's session completed on/off. Marking complete doesn't
 * require any sets to have been logged first — if today's workout_logs
 * row doesn't exist yet, it's created here (same as logSet does).
 */
export async function setSessionCompleted(
  input: SetSessionCompletedInput
): Promise<ActionResult<{ workoutLogId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  let workoutLogId = input.workoutLogId;
  if (!workoutLogId) {
    const created = await findOrCreateTodaysWorkoutLog(
      supabase,
      user.id,
      input.programDayId
    );
    if (!created.ok) return created;
    workoutLogId = created.data;
  }

  const { error } = await supabase
    .from("workout_logs")
    .update({ completed: input.completed })
    .eq("id", workoutLogId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Completion affects the "sessions this week" and streak stat cards,
  // which are rendered server-side in page.tsx — refresh so they pick up
  // the change. logSet() intentionally skips this: individual set saves
  // don't affect any stat card, and autosaving on every blur should stay
  // snappy rather than round-tripping a full page re-render.
  revalidatePath("/");
  return { ok: true, data: { workoutLogId } };
}
