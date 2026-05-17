import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STRENGTH_EXERCISES } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import StrengthClient from "./StrengthClient";

export default async function StrengthPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Strength</h1>
      <p className="text-[var(--muted)] mb-6">
        {STRENGTH_EXERCISES.length} cycling-specific lifts. Search by name, muscle group, or workout.
      </p>
      <StrengthClient exercises={STRENGTH_EXERCISES} />
    </main>
  );
}
