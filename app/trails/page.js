// /trails — rides-first view. Trails appear automatically as you ride; no manual list management.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogRideForm from "@/components/LogRideForm";
import DeleteRow from "@/components/DeleteRow";
import RideTrailsMultiPicker from "@/components/RideTrailsMultiPicker";
import StravaSyncResult from "@/components/StravaSyncResult";

export default async function TrailsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: trails }, { data: rides }] = await Promise.all([
    supabase.from("trails").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("rides")
      .select("*, ride_trails(trail_id, trails(id, name))")
      .eq("user_id", user.id)
      .order("date", { ascending: false }).limit(25),
  ]);

  const totalKm    = (rides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const totalElev  = (rides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);
  const totalMin   = (rides || []).reduce((a, r) => a + (+r.minutes || 0), 0);

  // Derive: trails that actually have rides on them (more useful than the raw list).
  const trailRideCount = {};
  (rides || []).forEach((r) => {
    (r.ride_trails || []).forEach((rt) => {
      trailRideCount[rt.trail_id] = (trailRideCount[rt.trail_id] || 0) + 1;
    });
  });
  const riddenTrails = (trails || [])
    .filter((t) => trailRideCount[t.id] > 0)
    .map((t) => ({ ...t, rideCount: trailRideCount[t.id] }))
    .sort((a, b) => b.rideCount - a.rideCount);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6 md:hidden">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
        <a href="/dashboard" className="flex items-center gap-2">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <span className="font-extrabold text-sm">RidgeLine</span>
        </a>
      </header>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-3xl font-extrabold">Trails & Rides</h1>
        <div className="flex gap-2">
          <a href="/trails/discover" className="btn-ghost text-sm">🌍 Discover trails</a>
        </div>
      </div>
      <p className="text-[var(--muted)] mb-6">
        Sync from Strava — trails you rode auto-populate. You don't manage a list; we figure it out.
      </p>

      <StravaSyncResult />

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

      <section className="mb-6">
        <LogRideForm userId={user.id} trails={trails || []} />
      </section>

      {/* Recent rides — primary view */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-3">Recent rides</h2>
        {!rides || rides.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No rides logged yet. Sync from Strava or use the form above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Trails ridden</th>
                  <th className="text-left p-2">Distance</th>
                  <th className="text-left p-2">Elev</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Notes</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => {
                  const linkedIds = (r.ride_trails || []).map(rt => rt.trail_id);
                  return (
                    <tr key={r.id} className="border-t border-[var(--line)] align-top">
                      <td className="p-2 whitespace-nowrap">{r.date}</td>
                      <td className="p-2">
                        <RideTrailsMultiPicker rideId={r.id} linkedTrailIds={linkedIds} trails={trails || []} />
                      </td>
                      <td className="p-2">{r.km ? `${r.km} km` : "—"}</td>
                      <td className="p-2">{r.elev_m ? `${r.elev_m} m` : "—"}</td>
                      <td className="p-2">{r.minutes} min</td>
                      <td className="p-2 text-[var(--muted)] max-w-xs truncate">{r.notes || ""}</td>
                      <td className="p-2 text-right">
                        <DeleteRow table="rides" id={r.id} confirm="Delete this ride?" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trails you've actually ridden (derived) — secondary, collapsible */}
      <details className="card">
        <summary className="cursor-pointer text-lg font-bold">
          Trails you've ridden ({riddenTrails.length})
        </summary>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Auto-populated from your rides. PRs only counted when a ride links to exactly one trail (otherwise the ride time isn't the trail time).
        </p>
        {riddenTrails.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No trail-linked rides yet — sync Strava or pick trails on rides above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Trail</th>
                  <th className="text-left p-2">Length</th>
                  <th className="text-left p-2">Difficulty</th>
                  <th className="text-left p-2">Rides</th>
                  <th className="text-left p-2">PR (solo rides only)</th>
                  <th className="text-left p-2">Last ride</th>
                </tr>
              </thead>
              <tbody>
                {riddenTrails.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--line)]">
                    <td className="p-2 font-semibold">{t.name}</td>
                    <td className="p-2">{t.length_km ? `${t.length_km} km` : "—"}</td>
                    <td className="p-2"><span className="text-xs px-2 py-0.5 rounded bg-[var(--panel2)] border border-[var(--line)]">{t.difficulty}</span></td>
                    <td className="p-2">{t.rideCount}</td>
                    <td className="p-2">{t.pr_minutes ? `${t.pr_minutes} min` : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className="p-2 text-[var(--muted)]">{t.last_ride || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </main>
  );
}
