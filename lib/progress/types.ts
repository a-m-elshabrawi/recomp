export type WeightPoint = {
  logged_date: string;
  weight_kg: number;
};

export type NutritionPoint = {
  logged_date: string;
  calories: number;
  protein_g: number;
};

export type NutritionTargets = {
  caloriesTarget: number | null;
  proteinTargetG: number | null;
};

export type WeeklySessionCount = {
  weekStartDate: string;
  count: number;
};

export type ExerciseOption = {
  id: string;
  name: string;
  dayName: string;
  dayOrder: number;
  exerciseOrder: number;
};

export type ExerciseProgressPoint = {
  date: string;
  avgReps: number | null;
  loggedSets: number;
};
