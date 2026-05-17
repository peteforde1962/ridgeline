import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { YOGA_POSES } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import YogaClient from "./YogaClient";

export default async function YogaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Yoga & Mobility</h1>
      <p className="text-[var(--muted)] mb-6">
        {YOGA_POSES.length} poses. Search by name, body part, or filter pre-ride vs post-ride.
      </p>
      <YogaClient poses={YOGA_POSES} />
    </main>
  );
}
