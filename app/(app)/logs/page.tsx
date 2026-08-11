import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type {
  NutritionLogEntry,
  WeeklyCheckinEntry,
  WeightLogEntry,
} from "@/lib/logs/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WeightLogSection } from "@/components/logs/weight-log-section";
import { NutritionLogSection } from "@/components/logs/nutrition-log-section";
import { WeeklyCheckinSection } from "@/components/logs/weekly-checkin-section";

export const metadata: Metadata = { title: "Logs — Recomp" };

const HISTORY_LIMIT_DAILY = 7;
const HISTORY_LIMIT_WEEKLY = 5;

export default async function LogsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [weightResult, nutritionResult, checkinsResult] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("id, logged_date, weight_kg, notes")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(HISTORY_LIMIT_DAILY),
    supabase
      .from("nutrition_logs")
      .select("id, logged_date, calories, protein_g, carbs_g, fat_g, notes")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(HISTORY_LIMIT_DAILY),
    supabase
      .from("weekly_checkins")
      .select(
        "id, week_start_date, sessions_completed, energy_rating, sleep_rating, avg_weight_kg, notes"
      )
      .eq("user_id", user.id)
      .order("week_start_date", { ascending: false })
      .limit(HISTORY_LIMIT_WEEKLY),
  ]);

  const weightHistory: WeightLogEntry[] = weightResult.data ?? [];
  const nutritionHistory: NutritionLogEntry[] = nutritionResult.data ?? [];
  const checkinHistory: WeeklyCheckinEntry[] = checkinsResult.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>

      <Tabs defaultValue="weight">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="weight" className="flex-1 sm:flex-none">
            Weight
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="flex-1 sm:flex-none">
            Nutrition
          </TabsTrigger>
          <TabsTrigger value="checkin" className="flex-1 sm:flex-none">
            Weekly check-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weight" className="pt-4">
          <WeightLogSection history={weightHistory} />
        </TabsContent>
        <TabsContent value="nutrition" className="pt-4">
          <NutritionLogSection history={nutritionHistory} />
        </TabsContent>
        <TabsContent value="checkin" className="pt-4">
          <WeeklyCheckinSection history={checkinHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
