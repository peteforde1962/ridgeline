import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FLOW_ROPE_DRILLS } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import RopeClient from "./RopeClient";

export default async function RopePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Flow Rope</h1>
      <p className="text-[var(--muted)] mb-6">
        {FLOW_ROPE_DRILLS.length} drills. Search by skill level or body focus.
      </p>
      <RopeClient drills={FLOW_ROPE_DRILLS} />
    </main>
  );
}
