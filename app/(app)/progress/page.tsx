import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getTodayKey } from "@/lib/dashboard/schedule";
import { countSessionsPerWeek, getRecentWeekStartKeys } from "@/lib/progress/weeks";
import type {
  ExerciseOption,
  NutritionPoint,
  NutritionTargets,
  WeightPoint,
} from "@/lib/progress/types";
import { WeightChartSection } from "@/components/progress/weight-chart-section";
import { ConsistencySection } from "@/components/progress/consistency-section";
import { StrengthSection } from "@/components/progress/strength-section";
import { NutritionTrendsSection } from "@/components/progress/nutrition-trends-section";

export const metadata: Metadata = { title: "Progress — Recomp" };

const CONSISTENCY_WEEKS = 12;
const HISTORY_LIMIT = 500;

// These sections are all "use client" (Recharts needs the browser —
// ResponsiveContainer measures its container via ResizeObserver). Next.js
// disallows next/dynamic(..., { ssr: false }) directly inside a Server
// Component, and since /progress is the only route that imports any of
// these, route-based code splitting already keeps recharts out of every
// other page's JS without needing an explicit dynamic import here.

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const todayKey = getTodayKey();
  const consistencyWeekKeys = getRecentWeekStartKeys(todayKey, CONSISTENCY_WEEKS);
  const consistencyStartDate = consistencyWeekKeys[0];

  const [
    weightResult,
    workoutLogsResult,
    programResult,
    nutritionLogsResult,
    nutritionTargetResult,
  ] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("logged_date, weight_kg")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("workout_logs")
      .select("log_date")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("log_date", consistencyStartDate)
      .order("log_date", { ascending: true }),
    supabase
      .from("programs")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_logs")
      .select("logged_date, calories, protein_g")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("nutrition_targets")
      .select("calories_target, protein_target_g")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  // Fetched newest-first (so a HISTORY_LIMIT cap keeps the most *recent*
  // data rather than the oldest), then reversed to ascending for charts.
  const weightHistory: WeightPoint[] = (weightResult.data ?? [])
    .slice()
    .reverse();

  const completedDateKeys = (workoutLogsResult.data ?? []).map(
    (row) => row.log_date as string
  );
  const weeklySessionCounts = countSessionsPerWeek(
    completedDateKeys,
    consistencyWeekKeys
  );

  const nutritionHistory: NutritionPoint[] = (nutritionLogsResult.data ?? [])
    .slice()
    .reverse();
  const nutritionTargets: NutritionTargets = {
    caloriesTarget: nutritionTargetResult.data?.calories_target ?? null,
    proteinTargetG: nutritionTargetResult.data?.protein_target_g ?? null,
  };

  // The exercise list depends on which program is active, so this query
  // chains after the parallel batch above rather than joining it there.
  let exerciseOptions: ExerciseOption[] = [];
  if (programResult.data) {
    const { data: days } = await supabase
      .from("program_days")
      .select(
        "id, day_order, name, program_exercises(id, name, exercise_order)"
      )
      .eq("program_id", programResult.data.id)
      .order("day_order", { ascending: true })
      .order("exercise_order", {
        referencedTable: "program_exercises",
        ascending: true,
      });

    exerciseOptions = (days ?? []).flatMap((day) =>
      (day.program_exercises ?? []).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        dayName: day.name,
        dayOrder: day.day_order,
        exerciseOrder: exercise.exercise_order,
      }))
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Weight over time
        </h2>
        <WeightChartSection history={weightHistory} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Workout consistency
        </h2>
        <ConsistencySection weeklyCounts={weeklySessionCounts} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Strength progression
        </h2>
        <StrengthSection exercises={exerciseOptions} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Nutrition trends
        </h2>
        <NutritionTrendsSection
          history={nutritionHistory}
          targets={nutritionTargets}
        />
      </section>
    </div>
  );
}
