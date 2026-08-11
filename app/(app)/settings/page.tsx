import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { NutritionTargetsForm } from "@/components/settings/nutrition-targets-form";

export const metadata: Metadata = { title: "Settings — Recomp" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [profileResult, targetsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "sex, date_of_birth, height_cm, baseline_weight_kg, activity_level, injury_notes"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("nutrition_targets")
      .select(
        "maintenance_kcal, calories_target, protein_target_g, fat_target_g, carbs_target_g"
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <ProfileForm initialProfile={profileResult.data} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Nutrition targets
        </h2>
        <NutritionTargetsForm initialTargets={targetsResult.data} />
      </section>
    </div>
  );
}
