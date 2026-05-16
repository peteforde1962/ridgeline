// Server-rendered dashboard.
// Loads user + profile + today's check-in, then renders.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayCheckin } = await supabase
    .from("check_ins")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  const displayName = profile?.name || user.email?.split("@")[0] || "rider";
  // "Profile not set up" heuristic: name is still the email prefix, AND no goal change yet.
  const needsSetup =
    !profile ||
    (profile.name === user.email?.split("@")[0] && profile.preset === "Sport" && profile.weekly_hours === 6);

  let readiness = null;
  let readinessLabel = null;
  if (todayCheckin) {
    readiness = todayCheckin.sleep + todayCheckin.energy - todayCheckin.soreness;
    readinessLabel =
      readiness <= 3 ? "Low — go Easier"   :
      readiness >= 8 ? "High — push Harder" :
                       "Standard day";
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-xl">RidgeLine</div>
        </div>
        <SignOutButton />
      </header>

      <section className="card mb-6">
        <h1 className="text-3xl font-extrabold mb-1">
          Hey, {displayName} 👋
        </h1>
        <p className="text-[var(--muted)] mb-4">
          {todayCheckin
            ? `You checked in today: ${readinessLabel}.`
            : "No check-in today — log one to tune your training intensity."}
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/today" className="btn-primary">🎯 Today's workout</a>
          <a href="/plan" className="btn-ghost">📅 Full plan</a>
          <a href="/checkin" className="btn-ghost">💚 Body check-in</a>
          <a href="/profile" className="btn-ghost">⚙️ Profile</a>
        </div>
      </section>

      {needsSetup && (
        <section className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <h2 className="text-lg font-bold mb-1">👋 Finish setting up your plan</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            Tell us about your riding so we can tailor the workouts. Takes 60 seconds.
          </p>
          <a href="/profile" className="btn-primary">Set up my profile</a>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Preset</div>
          <div className="text-xl font-extrabold">{profile?.preset || "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Weekly hours</div>
          <div className="text-xl font-extrabold">{profile?.weekly_hours ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Plan length</div>
          <div className="text-xl font-extrabold">{profile?.plan_weeks ?? "—"} weeks</div>
        </div>
      </section>

      {todayCheckin && (
        <section className="card mb-6">
          <h2 className="text-lg font-bold mb-2">Today's check-in</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Sleep</div>
              <div className="text-2xl font-extrabold">{todayCheckin.sleep}<span className="text-sm text-[var(--muted)]">/10</span></div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Soreness</div>
              <div className="text-2xl font-extrabold">{todayCheckin.soreness}<span className="text-sm text-[var(--muted)]">/10</span></div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Energy</div>
              <div className="text-2xl font-extrabold">{todayCheckin.energy}<span className="text-sm text-[var(--muted)]">/10</span></div>
            </div>
          </div>
          {todayCheckin.notes && (
            <p className="text-sm text-[var(--muted)] mt-3 italic">"{todayCheckin.notes}"</p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-bold mb-2">What's next</h2>
        <ol className="list-decimal list-inside space-y-2 text-[var(--muted)] text-sm">
          <li>
            <span className="text-[var(--text)]">Set up your profile</span> — pick your preset, hours, and goal.
          </li>
          <li>
            <span className="text-[var(--text)]">Check in daily</span> — even 10 seconds of feedback shapes your training.
          </li>
          <li>
            <span className="text-[var(--text)]">Coming next:</span> Today's workout, full Plan, Trails & Rides, Coach AI.
          </li>
        </ol>
      </section>
    </main>
  );
}
