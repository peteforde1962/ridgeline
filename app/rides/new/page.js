// /rides/new — focused full-page Log Ride form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogRideForm from "@/components/LogRideForm";
import PageHeader from "@/components/PageHeader";

export default async function NewRidePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trails } = await supabase
    .from("trails").select("*").eq("user_id", user.id).order("name");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader back="/trails" />

      <a href="/trails" className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-2 inline-block">← Trails & Rides</a>

      <h1 className="text-3xl font-extrabold mb-1">Log a ride</h1>
      <p className="text-[var(--muted)] mb-6">
        Manual entry. For Strava users, rides import automatically — no need to log here.
      </p>

      <LogRideForm userId={user.id} trails={trails || []} redirectAfterSave="/trails" />
    </main>
  );
}
