"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type {
  ExerciseLog,
  ProgramDay,
  TodaysWorkoutLog,
} from "@/lib/dashboard/types";
import { ExerciseCard } from "@/components/dashboard/exercise-card";
import type { SetEntry } from "@/components/dashboard/set-row";
import { logSet, setSessionCompleted } from "@/app/(app)/actions";

type SetsState = Record<string, SetEntry>;

function setKey(programExerciseId: string, setNumber: number) {
  return `${programExerciseId}:${setNumber}`;
}

function buildInitialSetsState(exerciseLogs: ExerciseLog[]): SetsState {
  const state: SetsState = {};
  for (const log of exerciseLogs) {
    if (!log.program_exercise_id) continue;
    state[setKey(log.program_exercise_id, log.set_number)] = {
      exerciseLogId: log.id,
      reps: log.reps_completed !== null ? String(log.reps_completed) : "",
      notes: log.notes ?? "",
      status: "saved",
    };
  }
  return state;
}

const EMPTY_ENTRY: SetEntry = {
  exerciseLogId: null,
  reps: "",
  notes: "",
  status: "idle",
};

export function DashboardClient({
  days,
  initialSelectedDayId,
  initialWorkoutLog,
  initialExerciseLogs,
}: {
  days: ProgramDay[];
  initialSelectedDayId: string;
  initialWorkoutLog: TodaysWorkoutLog | null;
  initialExerciseLogs: ExerciseLog[];
}) {
  const router = useRouter();
  const [selectedDayId, setSelectedDayId] = useState(initialSelectedDayId);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(
    initialWorkoutLog?.id ?? null
  );
  const [completed, setCompleted] = useState(
    initialWorkoutLog?.completed ?? false
  );
  const [isTogglingComplete, setIsTogglingComplete] = useState(false);
  const [sets, setSets] = useState<SetsState>(() =>
    buildInitialSetsState(initialExerciseLogs)
  );

  const selectedDay = useMemo(
    () => days.find((d) => d.id === selectedDayId) ?? days[0],
    [days, selectedDayId]
  );

  function getSetEntry(programExerciseId: string, setNumber: number): SetEntry {
    return sets[setKey(programExerciseId, setNumber)] ?? EMPTY_ENTRY;
  }

  function patchSetEntry(
    programExerciseId: string,
    setNumber: number,
    patch: Partial<SetEntry>
  ) {
    const key = setKey(programExerciseId, setNumber);
    setSets((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_ENTRY), ...patch },
    }));
  }

  async function saveSet(
    programExerciseId: string,
    exerciseName: string,
    setNumber: number
  ) {
    const key = setKey(programExerciseId, setNumber);
    const entry = sets[key] ?? EMPTY_ENTRY;

    // Nothing entered — skip the round trip rather than writing an empty row.
    if (entry.reps.trim() === "" && entry.notes.trim() === "") {
      return;
    }

    patchSetEntry(programExerciseId, setNumber, { status: "saving" });

    const result = await logSet({
      programDayId: selectedDay.id,
      programExerciseId,
      exerciseName,
      setNumber,
      repsCompleted: entry.reps.trim() === "" ? null : Number(entry.reps),
      notes: entry.notes.trim() === "" ? null : entry.notes.trim(),
    });

    if (!result.ok) {
      patchSetEntry(programExerciseId, setNumber, { status: "error" });
      return;
    }

    if (!workoutLogId) {
      setWorkoutLogId(result.data.workoutLogId);
    }

    patchSetEntry(programExerciseId, setNumber, {
      exerciseLogId: result.data.exerciseLogId,
      status: "saved",
    });
  }

  async function handleToggleComplete() {
    setIsTogglingComplete(true);
    const nextCompleted = !completed;

    const result = await setSessionCompleted({
      workoutLogId,
      programDayId: selectedDay.id,
      completed: nextCompleted,
    });

    if (result.ok) {
      setCompleted(nextCompleted);
      setWorkoutLogId(result.data.workoutLogId);
      // Completion changes the "this week" / streak stat cards, which are
      // rendered server-side above this component — refresh to pick them
      // up. This component's own state (selected day, logged sets) isn't
      // reset by that, since it lives in useState here, not in props.
      router.refresh();
    }

    setIsTogglingComplete(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={selectedDayId}
        onValueChange={(value) => setSelectedDayId(value as string)}
      >
        <TabsList className="w-full sm:w-auto">
          {days.map((day, index) => (
            <TabsTrigger
              key={day.id}
              value={day.id}
              className="flex-1 sm:flex-none"
            >
              Day {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {selectedDay.name}
        </h2>
        <Button
          size="sm"
          variant={completed ? "secondary" : "default"}
          onClick={handleToggleComplete}
          disabled={isTogglingComplete}
        >
          {completed ? "✓ Session complete" : "Mark session complete"}
        </Button>
      </div>

      {selectedDay.exercises.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No exercises set up for this day yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {selectedDay.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              getSetEntry={(setNumber) => getSetEntry(exercise.id, setNumber)}
              onRepsChange={(setNumber, value) =>
                patchSetEntry(exercise.id, setNumber, {
                  reps: value,
                  status: "idle",
                })
              }
              onNotesChange={(setNumber, value) =>
                patchSetEntry(exercise.id, setNumber, {
                  notes: value,
                  status: "idle",
                })
              }
              onSave={(setNumber) =>
                saveSet(exercise.id, exercise.name, setNumber)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
