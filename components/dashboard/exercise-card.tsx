import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProgramExercise } from "@/lib/dashboard/types";
import { SetRow, type SetEntry } from "@/components/dashboard/set-row";

export function ExerciseCard({
  exercise,
  getSetEntry,
  onRepsChange,
  onNotesChange,
  onSave,
}: {
  exercise: ProgramExercise;
  getSetEntry: (setNumber: number) => SetEntry;
  onRepsChange: (setNumber: number, value: string) => void;
  onNotesChange: (setNumber: number, value: string) => void;
  onSave: (setNumber: number) => void;
}) {
  const setNumbers = Array.from({ length: exercise.sets }, (_, i) => i + 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{exercise.name}</CardTitle>
        <CardDescription>
          {exercise.sets} sets &times; {exercise.reps}
          {exercise.rest_seconds ? ` · rest ${exercise.rest_seconds}s` : ""}
        </CardDescription>
        {exercise.notes && (
          <p className="text-xs text-muted-foreground">{exercise.notes}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {setNumbers.map((setNumber) => (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            entry={getSetEntry(setNumber)}
            onRepsChange={(value) => onRepsChange(setNumber, value)}
            onNotesChange={(value) => onNotesChange(setNumber, value)}
            onSave={() => onSave(setNumber)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
