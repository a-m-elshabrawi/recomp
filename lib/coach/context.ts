import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToKey, getTodayKey } from "@/lib/dashboard/schedule";

const HISTORY_DAYS = 14;

/**
 * Builds a plain-text context block describing this user's profile,
 * targets, program, and recent history, for injection into the coach's
 * system prompt.
 *
 * READ-ONLY: every call below is a `select()`. This function must never
 * insert/update/delete anything — the coach route only needs to *read*
 * the user's data to have context for the conversation.
 */
export async function buildCoachContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const todayKey = getTodayKey();
  const historyStart = addDaysToKey(todayKey, -(HISTORY_DAYS - 1));

  const [
    profileResult,
    nutritionTargetResult,
    programResult,
    weightLogsResult,
    workoutLogsResult,
    nutritionLogsResult,
  ] = await Promise.all([
    // READ-ONLY: profile basics for context, nothing written.
    supabase
      .from("profiles")
      .select("full_name, date_of_birth, sex, height_cm, activity_level, goal")
      .eq("id", userId)
      .maybeSingle(),
    // READ-ONLY.
    supabase
      .from("nutrition_targets")
      .select("calories_target, protein_target_g, carbs_target_g, fat_target_g")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    // READ-ONLY.
    supabase
      .from("programs")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    // READ-ONLY.
    supabase
      .from("weight_logs")
      .select("logged_date, weight_kg, notes")
      .eq("user_id", userId)
      .gte("logged_date", historyStart)
      .order("logged_date", { ascending: true }),
    // READ-ONLY.
    supabase
      .from("workout_logs")
      .select("log_date, program_day_id, completed")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("log_date", historyStart)
      .order("log_date", { ascending: true }),
    // READ-ONLY.
    supabase
      .from("nutrition_logs")
      .select("logged_date, calories, protein_g, carbs_g, fat_g, notes")
      .eq("user_id", userId)
      .gte("logged_date", historyStart)
      .order("logged_date", { ascending: true }),
  ]);

  const sections: string[] = [];

  // ---- Profile ------------------------------------------------------------
  const profile = profileResult.data;
  const age = profile?.date_of_birth ? ageFromDateOfBirth(profile.date_of_birth) : null;
  sections.push(
    [
      "USER PROFILE:",
      `- Name: ${profile?.full_name ?? "Not provided"}`,
      `- Age: ${age !== null ? age : "Not provided"}`,
      `- Sex: ${profile?.sex ?? "Not provided"}`,
      `- Height: ${profile?.height_cm ? `${profile.height_cm} cm` : "Not provided"}`,
      `- Activity level: ${profile?.activity_level ?? "Not provided"}`,
      `- Goal: ${profile?.goal ?? "Not provided"}`,
    ].join("\n")
  );

  // ---- Nutrition targets ----------------------------------------------------
  const targets = nutritionTargetResult.data;
  sections.push(
    targets
      ? [
          "NUTRITION TARGETS:",
          `- Calories: ${targets.calories_target} kcal/day`,
          `- Protein: ${targets.protein_target_g} g/day`,
          `- Carbs: ${targets.carbs_target_g} g/day`,
          `- Fat: ${targets.fat_target_g} g/day`,
        ].join("\n")
      : "NUTRITION TARGETS: None set."
  );

  // ---- Active program -------------------------------------------------------
  const program = programResult.data;
  const dayNameById = new Map<string, string>();
  if (program) {
    // READ-ONLY.
    const { data: days } = await supabase
      .from("program_days")
      .select(
        "id, day_order, name, program_exercises(name, sets, reps, rest_seconds, notes, exercise_order)"
      )
      .eq("program_id", program.id)
      .order("day_order", { ascending: true })
      .order("exercise_order", {
        referencedTable: "program_exercises",
        ascending: true,
      });

    const dayLines: string[] = [`ACTIVE PROGRAM: "${program.name}"`];
    for (const day of days ?? []) {
      dayNameById.set(day.id, day.name);
      dayLines.push(`${day.name}:`);
      const exercises = day.program_exercises ?? [];
      if (exercises.length === 0) {
        dayLines.push("  (no exercises set up)");
      }
      for (const exercise of exercises) {
        const restNote = exercise.rest_seconds
          ? `, rest ${exercise.rest_seconds}s`
          : "";
        const noteSuffix = exercise.notes ? ` — ${exercise.notes}` : "";
        dayLines.push(
          `  - ${exercise.name}: ${exercise.sets} sets x ${exercise.reps}${restNote}${noteSuffix}`
        );
      }
    }
    sections.push(dayLines.join("\n"));
  } else {
    sections.push("ACTIVE PROGRAM: None set up.");
  }

  // ---- Recent weight ---------------------------------------------------------
  const weightLogs = weightLogsResult.data ?? [];
  sections.push(
    weightLogs.length > 0
      ? [
          `RECENT WEIGHT LOGS (last ${HISTORY_DAYS} days):`,
          ...weightLogs.map(
            (log) =>
              `- ${log.logged_date}: ${log.weight_kg} kg${log.notes ? ` (${log.notes})` : ""}`
          ),
        ].join("\n")
      : `RECENT WEIGHT LOGS (last ${HISTORY_DAYS} days): None logged.`
  );

  // ---- Recent completed workouts ----------------------------------------------
  const workoutLogs = workoutLogsResult.data ?? [];
  sections.push(
    workoutLogs.length > 0
      ? [
          `RECENT COMPLETED WORKOUTS (last ${HISTORY_DAYS} days):`,
          ...workoutLogs.map((log) => {
            const dayName = log.program_day_id
              ? (dayNameById.get(log.program_day_id) ?? "Unknown day")
              : "Unknown day";
            return `- ${log.log_date}: ${dayName}`;
          }),
        ].join("\n")
      : `RECENT COMPLETED WORKOUTS (last ${HISTORY_DAYS} days): None completed.`
  );

  // ---- Recent nutrition --------------------------------------------------------
  const nutritionLogs = nutritionLogsResult.data ?? [];
  sections.push(
    nutritionLogs.length > 0
      ? [
          `RECENT NUTRITION LOGS (last ${HISTORY_DAYS} days):`,
          ...nutritionLogs.map(
            (log) =>
              `- ${log.logged_date}: ${log.calories} kcal, P${log.protein_g}g C${log.carbs_g}g F${log.fat_g}g${
                log.notes ? ` (${log.notes})` : ""
              }`
          ),
        ].join("\n")
      : `RECENT NUTRITION LOGS (last ${HISTORY_DAYS} days): None logged.`
  );

  return sections.join("\n\n");
}

function ageFromDateOfBirth(dateOfBirth: string): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const dob = new Date(year, month - 1, day);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
