// /profile — edit rider profile, plan settings, integrations (Strava).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import StravaCard from "@/components/StravaCard";
import PageHeader from "@/components/PageHeader";

export default async function ProfilePage({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const stravaStatus = searchParams?.strava || "";

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />

      <h1 className="text-3xl font-extrabold mb-1">Profile</h1>
      <p className="text-[var(--muted)] mb-6">
        Tune your plan to your reality. Changes save instantly.
      </p>

      <div className="space-y-4">
        <ProfileForm userId={user.id} profile={profile} />

        <StravaCard
          connected={!!profile?.strava_refresh_token}
          athleteId={profile?.strava_athlete_id}
          lastSyncAt={profile?.strava_last_sync_at}
          strava={stravaStatus}
        />
      </div>
    </main>
  );
}
