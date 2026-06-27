import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import SkillsForm from "@/components/SkillsForm";

export default async function SkillsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: ratings }, { data: profile }] = await Promise.all([
    supabase.from("skills").select("*").eq("user_id", user.id),
    supabase.from("profiles").select("focus_skills").eq("id", user.id).single(),
  ]);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Skills Profile</h1>
      <p className="text-[var(--muted)] mb-6">
        Rate yourself 1–10. Pick up to 4 focus skills — they bias your plan.
      </p>

      <SkillsForm userId={user.id} ratings={ratings || []} focusSkills={profile?.focus_skills || []} />

      <section className="card-glass mt-6">
        <h2 className="text-lg font-bold mb-2">How this changes your plan</h2>
        <p className="text-sm text-[var(--muted)]">
          Coach AI will see your focus skills and weight workouts toward them. Endurance → more Z2 volume.
          Power → more intervals. Cornering / Descents / Drops → more flow rope &amp; skills clinics. Mobility → more yoga.
        </p>
      </section>
    </main>
  );
}
