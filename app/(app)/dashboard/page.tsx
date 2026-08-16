import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatWeightKg } from "@/lib/units";
import { average } from "@/lib/stats";
import {
  addDaysToKey,
  computeDefaultDayId,
  computeStreak,
  countSessionsThisWeek,
  getTodayKey,
  SESSIONS_PER_WEEK_TARGET,
} from "@/lib/dashboard/schedule";
import type { ExerciseLog, ProgramDay, TodaysWorkoutLog } from "@/lib/dashboard/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { BarbellPlates } from "@/components/training-ledger/barbell-plates";

export const metadata: Metadata = { title: "Dashboard — Recomp" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already guarantees an authenticated user; this is
  // just a type-narrowing guard.
  if (!user) {
    return null;
  }

  const todayKey = getTodayKey();

  const [programResult, weightLogsResult] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_logs")
      .select("logged_date, weight_kg")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(30),
  ]);

  const program = programResult.data;
  const weightLogs = weightLogsResult.data ?? [];

  // ---- Weight stat cards --------------------------------------------------
  const currentWeightEntry = weightLogs[0] ?? null;
  const sevenDaysAgoKey = addDaysToKey(todayKey, -6);
  const last7DaysEntries = weightLogs.filter(
    (entry) => entry.logged_date >= sevenDaysAgoKey && entry.logged_date <= todayKey
  );
  const avg7dKg = average(last7DaysEntries.map((entry) => entry.weight_kg));

  // ---- No active program: friendly empty state, nothing else to fetch ----
  if (!program) {
    return (
      <div className="flex flex-col gap-6">
        <StatCardsRow
          currentWeightEntry={currentWeightEntry}
          avg7dKg={avg7dKg}
          weeklyCount={0}
          streak={0}
        />
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No active program found. Once a program is set up, today&apos;s
          workout will show up here.
        </div>
      </div>
    );
  }

  const [daysResult, completedLogsResult, todaysLogResult] = await Promise.all([
    supabase
      .from("program_days")
      .select(
        "id, program_id, day_order, name, program_exercises(id, program_day_id, exercise_order, name, sets, reps, rest_seconds, notes)"
      )
      .eq("program_id", program.id)
      .order("day_order", { ascending: true })
      .order("exercise_order", {
        referencedTable: "program_exercises",
        ascending: true,
      }),
    supabase
      .from("workout_logs")
      .select("id, program_day_id, log_date")
      .eq("user_id", user.id)
      .eq("completed", true)
      .order("log_date", { ascending: false })
      .limit(500),
    supabase
      .from("workout_logs")
      .select("id, program_day_id, log_date, completed")
      .eq("user_id", user.id)
      .eq("log_date", todayKey)
      .maybeSingle(),
  ]);

  const days: ProgramDay[] = (daysResult.data ?? []).map((day) => ({
    id: day.id,
    program_id: day.program_id,
    day_order: day.day_order,
    name: day.name,
    exercises: (day.program_exercises ?? []).sort(
      (a, b) => a.exercise_order - b.exercise_order
    ),
  }));

  const completedLogs = completedLogsResult.data ?? [];
  const completedDateKeys = completedLogs.map((log) => log.log_date as string);
  const lastCompletedDayId = completedLogs[0]?.program_day_id ?? null;

  const todaysWorkoutLog: TodaysWorkoutLog | null = todaysLogResult.data
    ? {
        id: todaysLogResult.data.id,
        program_day_id: todaysLogResult.data.program_day_id,
        log_date: todaysLogResult.data.log_date,
        completed: todaysLogResult.data.completed,
      }
    : null;

  let todaysExerciseLogs: ExerciseLog[] = [];
  if (todaysWorkoutLog) {
    const { data } = await supabase
      .from("exercise_logs")
      .select(
        "id, workout_log_id, program_exercise_id, exercise_name, set_number, reps_completed, notes"
      )
      .eq("workout_log_id", todaysWorkoutLog.id);
    todaysExerciseLogs = data ?? [];
  }

  const weeklyCount = countSessionsThisWeek(completedDateKeys, todayKey);
  const streak = computeStreak(completedDateKeys, todayKey);

  const defaultDayId = computeDefaultDayId(
    days.map((d) => ({ id: d.id, day_order: d.day_order })),
    {
      todaysProgramDayId: todaysWorkoutLog?.program_day_id ?? null,
      lastCompletedProgramDayId: lastCompletedDayId,
    }
  );

  if (days.length === 0 || !defaultDayId) {
    return (
      <div className="flex flex-col gap-6">
        <StatCardsRow
          currentWeightEntry={currentWeightEntry}
          avg7dKg={avg7dKg}
          weeklyCount={weeklyCount}
          streak={streak}
        />
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Your active program doesn&apos;t have any days set up yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StatCardsRow
        currentWeightEntry={currentWeightEntry}
        avg7dKg={avg7dKg}
        weeklyCount={weeklyCount}
        streak={streak}
      />
      <DashboardClient
        days={days}
        initialSelectedDayId={defaultDayId}
        initialWorkoutLog={todaysWorkoutLog}
        initialExerciseLogs={todaysExerciseLogs}
      />
    </div>
  );
}

function StatCardsRow({
  currentWeightEntry,
  avg7dKg,
  weeklyCount,
  streak,
}: {
  currentWeightEntry: { logged_date: string; weight_kg: number } | null;
  avg7dKg: number | null;
  weeklyCount: number;
  streak: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Current weight"
        value={
          currentWeightEntry
            ? formatWeightKg(currentWeightEntry.weight_kg)
            : "No data yet"
        }
      />
      <StatCard
        label="7-day avg weight"
        value={avg7dKg !== null ? formatWeightKg(avg7dKg) : "No data yet"}
      />
      <StatCard label="This week" hint="sessions completed">
        <BarbellPlates
          completed={weeklyCount}
          total={SESSIONS_PER_WEEK_TARGET}
          size="sm"
        />
      </StatCard>
      <StatCard
        label="Streak"
        value={`${streak}`}
        hint={streak === 1 ? "week" : "weeks"}
      />
    </div>
  );
}
