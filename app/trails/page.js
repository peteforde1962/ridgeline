// /trails — log rides, manage trails, see stats.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogRideForm from "@/components/LogRideForm";
import AddTrailForm from "@/components/AddTrailForm";
import DeleteRow from "@/components/DeleteRow";
import MatchTrailsButton from "@/components/MatchTrailsButton";

export default async function TrailsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trails } = await supabase
    .from("trails").select("*").eq("user_id", user.id).order("name");

  const { data: rides } = await supabase
    .from("rides").select("*, trails(name)").eq("user_id", user.id)
    .order("date", { ascending: false }).limit(25);

  // Aggregate stats (metric)
  const totalKm    = (rides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const totalElev  = (rides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);
  const totalMin   = (rides || []).reduce((a, r) => a + (+r.minutes || 0), 0);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
        <div className="flex items-center gap-2">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-3xl font-extrabold">Trails & Rides</h1>
        <a href="/trails/discover" className="btn-ghost text-sm">🌍 Discover trails</a>
      </div>
      <p className="text-[var(--muted)] mb-6">Log rides, track trail PRs, see where your saddle time goes.</p>

      {/* Stats cards */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Total distance</div>
          <div className="text-2xl font-extrabold">{totalKm.toFixed(1)} <span className="text-sm text-[var(--muted)]">km</span></div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Total elevation</div>
          <div className="text-2xl font-extrabold">{totalElev.toLocaleString()} <span className="text-sm text-[var(--muted)]">m</span></div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Saddle time</div>
          <div className="text-2xl font-extrabold">{Math.round(totalMin / 60)} <span className="text-sm text-[var(--muted)]">hr</span></div>
        </div>
      </section>

      {/* Log a ride */}
      <section className="mb-6">
        <LogRideForm userId={user.id} trails={trails || []} />
      </section>

      {/* Trails table */}
      <section className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Your trails</h2>
          <AddTrailForm userId={user.id} />
        </div>
        {!trails || trails.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No trails saved yet. Add your local favorites above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Trail</th>
                  <th className="text-left p-2">Length</th>
                  <th className="text-left p-2">Elev</th>
                  <th className="text-left p-2">Difficulty</th>
                  <th className="text-left p-2">PR</th>
                  <th className="text-left p-2">Last ride</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {trails.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--line)]">
                    <td className="p-2 font-semibold">{t.name}</td>
                    <td className="p-2">{t.length_km ? `${t.length_km} km` : "—"}</td>
                    <td className="p-2">{t.elev_m ? `${t.elev_m} m` : "—"}</td>
                    <td className="p-2"><span className="text-xs px-2 py-0.5 rounded bg-[var(--panel2,#1d2a23)] border border-[var(--line)]">{t.difficulty}</span></td>
                    <td className="p-2">{t.pr_minutes ? `${t.pr_minutes} min` : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className="p-2 text-[var(--muted)]">{t.last_ride || "—"}</td>
                    <td className="p-2 text-right">
                      <DeleteRow table="trails" id={t.id} confirm={`Delete trail "${t.name}"? Rides linked to it stay logged.`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent rides */}
      <section className="card">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-bold">Recent rides</h2>
          <MatchTrailsButton />
        </div>
        {!rides || rides.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No rides logged yet. Use the form above to log your first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Trail</th>
                  <th className="text-left p-2">Distance</th>
                  <th className="text-left p-2">Elev</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Feel</th>
                  <th className="text-left p-2">Notes</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2">{r.trails?.name || <span className="text-[var(--muted)]">—</span>}</td>
                    <td className="p-2">{r.km ? `${r.km} km` : "—"}</td>
                    <td className="p-2">{r.elev_m ? `${r.elev_m} m` : "—"}</td>
                    <td className="p-2">{r.minutes} min</td>
                    <td className="p-2">{"⭐".repeat(r.feel || 0)}</td>
                    <td className="p-2 text-[var(--muted)] max-w-xs truncate">{r.notes || ""}</td>
                    <td className="p-2 text-right">
                      <DeleteRow table="rides" id={r.id} confirm="Delete this ride?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
