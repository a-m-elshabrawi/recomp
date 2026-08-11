export type WeightLogEntry = {
  id: string;
  logged_date: string;
  weight_kg: number;
  notes: string | null;
};

export type NutritionLogEntry = {
  id: string;
  logged_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
};

export type WeeklyCheckinEntry = {
  id: string;
  week_start_date: string;
  sessions_completed: number;
  energy_rating: number;
  sleep_rating: number;
  avg_weight_kg: number | null;
  notes: string | null;
};
