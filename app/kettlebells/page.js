// /kettlebells — the kettlebell-only slice of the strength library.
// Pre-filters STRENGTH_EXERCISES to workout === "Kettlebell" so the user
// drops straight into KB content. Reuses StrengthClient so the rendering,
// search, and tags stay consistent with /strength.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STRENGTH_EXERCISES } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import StrengthClient from "../strength/StrengthClient";

export default async function KettlebellsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kbOnly = STRENGTH_EXERCISES.filter((e) => e.workout === "Kettlebell");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Kettlebells</h1>
      <p className="text-[var(--muted)] mb-6">
        {kbOnly.length} MTB-tuned kettlebell movements. Swings, get-ups, carries — climb power, anti-rotation core, full-body control.
      </p>
      <StrengthClient exercises={kbOnly} />
    </main>
  );
}
