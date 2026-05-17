import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RUN_SESSIONS } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import RunClient from "./RunClient";

export default async function RunPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Running (Cross-training)</h1>
      <p className="text-[var(--muted)] mb-6">
        {RUN_SESSIONS.length} session types. Search by intensity or phase.
      </p>
      <RunClient sessions={RUN_SESSIONS} />
    </main>
  );
}
