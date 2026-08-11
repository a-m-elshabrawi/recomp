export type ProgramExercise = {
  id: string;
  program_day_id: string;
  exercise_order: number;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
};

export type ProgramDay = {
  id: string;
  program_id: string;
  day_order: number;
  name: string;
  exercises: ProgramExercise[];
};

export type ExerciseLog = {
  id: string;
  workout_log_id: string;
  program_exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps_completed: number | null;
  notes: string | null;
};

export type TodaysWorkoutLog = {
  id: string;
  program_day_id: string | null;
  log_date: string;
  completed: boolean;
};
