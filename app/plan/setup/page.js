// /plan/setup — dedicated plan management page.
// Was previously wedged into /profile. Now this is the single place a rider
// goes to configure their plan (preset, weeks, workout days, activities,
// body/skill focus, holidays) so /profile stays focused on identity + integrations.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import PlanSetupForm from "@/components/PlanSetupForm";
import PlanPauses from "@/components/PlanPauses";

export default async function PlanSetupPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const planActive = !!profile?.started_at;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />

      <div className="flex items-center justify-between mb-2">
        <a href={planActive ? "/plan" : "/dashboard"}
           className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
          ← Back
        </a>
      </div>

      <h1 className="text-3xl font-extrabold mb-1">Plan setup</h1>
      <p className="text-[var(--muted)] mb-6">
        {planActive
          ? "Adjust how your training plan is built. Changes take effect on the next page load."
          : "Set up your first training plan. All settings are editable later."}
      </p>

      <section className="mb-6">
        <PlanSetupForm userId={user.id} profile={profile} />
      </section>

      <section className="mb-6">
        <PlanPauses userId={user.id} />
      </section>
    </main>
  );
}
