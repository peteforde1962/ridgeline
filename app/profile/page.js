// /profile — edit rider profile, plan settings, integrations (Strava).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RiderIdentityForm from "@/components/RiderIdentityForm";
import StravaCard from "@/components/StravaCard";
import SuuntoCard from "@/components/SuuntoCard";
import GarminCard from "@/components/GarminCard";
import PageHeader from "@/components/PageHeader";
import EmailPrefs from "@/components/EmailPrefs";
import CoachInviteCard from "@/components/CoachInviteCard";
import StudentCoachCard from "@/components/StudentCoachCard";
import RoleSwitcher from "@/components/RoleSwitcher";
import TrainingZones from "@/components/TrainingZones";

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
  const suuntoStatus = searchParams?.suunto || "";
  const garminStatus = searchParams?.garmin || "";

  // If the student has a coach, load the coach profile for display.
  let coach = null;
  if (profile?.coach_id) {
    const { data } = await supabase
      .from("profiles").select("id, name, email")
      .eq("id", profile.coach_id).maybeSingle();
    coach = data;
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />

      <h1 className="text-3xl font-extrabold mb-1">Profile</h1>
      <p className="text-[var(--muted)] mb-6">
        Tune your plan to your reality. Changes save instantly.
      </p>

      <div className="space-y-4">
        <RoleSwitcher profile={profile} />

        {profile?.role === "coach"
          ? <CoachInviteCard profile={profile} />
          : <StudentCoachCard profile={profile} coach={coach} />}

        <RiderIdentityForm userId={user.id} profile={profile} />

        {/* Plan configuration lives on its own page — this card is just a
            summary + shortcut so /profile stays about identity + integrations. */}
        <div className="card flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-bold mb-0.5">Training plan</h2>
            <p className="text-sm text-[var(--muted)]">
              {profile?.started_at
                ? <>Started <strong className="text-[var(--text)]">{profile.started_at}</strong> · {profile?.plan_weeks || 12} weeks · {profile?.preset || "Sport"} preset</>
                : <>You don't have an active plan yet.</>}
            </p>
          </div>
          <a href="/plan/setup" className="btn-primary text-sm">
            {profile?.started_at ? "Manage plan →" : "Set up plan →"}
          </a>
        </div>

        <TrainingZones profile={profile} />

        <EmailPrefs userId={user.id} profile={profile} />

        <StravaCard
          connected={!!profile?.strava_refresh_token}
          athleteId={profile?.strava_athlete_id}
          lastSyncAt={profile?.strava_last_sync_at}
          strava={stravaStatus}
        />

        <SuuntoCard
          connected={!!profile?.suunto_refresh_token}
          userId={profile?.suunto_user_id}
          lastSyncAt={profile?.suunto_last_sync_at}
          suunto={suuntoStatus}
        />

        <GarminCard
          connected={!!profile?.garmin_refresh_token}
          userId={profile?.garmin_user_id}
          lastSyncAt={profile?.garmin_last_sync_at}
          garmin={garminStatus}
        />
      </div>
    </main>
  );
}
