// /bodyweight — no-equipment slice of the strength library.
// Pre-filters STRENGTH_EXERCISES to workout === "Body Weight" so the user
// drops straight into BW content. Reuses StrengthClient so the rendering,
// search, and tags stay consistent with /strength.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STRENGTH_EXERCISES } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import StrengthClient from "../strength/StrengthClient";

export default async function BodyweightPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bwOnly = STRENGTH_EXERCISES.filter((e) => e.workout === "Body Weight");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Body Weight</h1>
      <p className="text-[var(--muted)] mb-6">
        {bwOnly.length} no-equipment moves you can do anywhere. Travel, hotel rooms, trailhead warm-ups, off-day strength.
      </p>
      <StrengthClient exercises={bwOnly} />
    </main>
  );
}
