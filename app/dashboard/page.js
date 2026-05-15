// Server-rendered dashboard.
// Loads the current user + profile from Supabase, then renders the page.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch this user's profile row (auto-created on signup by the SQL trigger).
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name || user.email?.split("@")[0] || "rider";

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
        <p className="text-[var(--muted)]">
          You're signed in. This data came from the database. That's the moment your prototype became real.
        </p>
      </section>

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

      <section className="card">
        <h2 className="text-lg font-bold mb-2">What's next</h2>
        <ol className="list-decimal list-inside space-y-2 text-[var(--muted)] text-sm">
          <li>
            <span className="text-[var(--text)]">Test it on your phone.</span> Open this URL on your phone and log in
            with the same account. You should see the same data — that's the real test of "it's real now."
          </li>
          <li>
            <span className="text-[var(--text)]">Port the prototype features.</span> Next we move
            <code className="mx-1 text-[var(--accent2,#f4b860)]">Today</code> /
            <code className="mx-1 text-[var(--accent2,#f4b860)]">Plan</code> /
            <code className="mx-1 text-[var(--accent2,#f4b860)]">Check-in</code> / etc. one screen at a time.
          </li>
          <li>
            <span className="text-[var(--text)]">Deploy to Vercel.</span> See the README — about 10 minutes.
          </li>
        </ol>
      </section>
    </main>
  );
}
