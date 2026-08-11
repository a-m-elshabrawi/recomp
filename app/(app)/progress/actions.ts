"use server";

import { createClient } from "@/lib/supabase/server";
import { average } from "@/lib/stats";
import type { ExerciseProgressPoint } from "@/lib/progress/types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Reps logged for one exercise over time, one point per session
 * (workout_logs row) that exercise was logged in. Each point averages
 * reps_completed across whichever sets were actually logged that session
 * — see components/progress/strength-section.tsx for why "average reps
 * per session" was chosen as the representation.
 *
 * Fetched on demand (rather than upfront for every exercise) since a
 * program can have ~20 exercises and most sessions only touch one; there
 * is no reason to pull exercise_logs for exercises the user hasn't
 * selected yet.
 */
export async function getExerciseProgressLogs(
  programExerciseId: string
): Promise<ActionResult<ExerciseProgressPoint[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // No explicit user_id filter needed here: RLS on exercise_logs already
  // restricts rows to ones whose workout_logs.user_id = auth.uid().
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("reps_completed, workout_logs(log_date)")
    .eq("program_exercise_id", programExerciseId);

  if (error) return { ok: false, error: error.message };

  // Without generated Database types, the client can't statically confirm
  // this is a to-one embed (exercise_logs -> workout_logs via a FK on
  // exercise_logs itself), so it's typed defensively as possibly an
  // array; handle both shapes rather than assuming one.
  type EmbeddedWorkoutLog = { log_date: string } | { log_date: string }[] | null;

  const repsBySessionDate = new Map<string, number[]>();
  for (const row of data ?? []) {
    const embedded = row.workout_logs as EmbeddedWorkoutLog;
    const workoutLog = Array.isArray(embedded) ? embedded[0] : embedded;
    if (!workoutLog || row.reps_completed === null) continue;

    const existing = repsBySessionDate.get(workoutLog.log_date) ?? [];
    existing.push(row.reps_completed);
    repsBySessionDate.set(workoutLog.log_date, existing);
  }

  const points: ExerciseProgressPoint[] = Array.from(
    repsBySessionDate.entries()
  )
    .map(([date, reps]) => ({
      date,
      avgReps: average(reps),
      loggedSets: reps.length,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { ok: true, data: points };
}
