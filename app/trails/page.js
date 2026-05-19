// /trails — rides-first. Log button → /rides/new. Trails-ridden as a word cloud.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteRow from "@/components/DeleteRow";
import StravaSyncResult from "@/components/StravaSyncResult";
import TrailCloud from "@/components/TrailCloud";

export default async function TrailsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: trails }, { data: rides }] = await Promise.all([
    supabase.from("trails").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("rides")
      .select("id, date, km, elev_m, minutes, notes, ride_trails(trail_id, seconds_on_trail)")
      .eq("user_id", user.id)
      .order("date", { ascending: false }).limit(25),
  ]);

  const totalKm    = (rides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const totalElev  = (rides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);
  const totalMin   = (rides || []).reduce((a, r) => a + (+r.minutes || 0), 0);

  // Compute trail stats: ride count + fastest seconds per trail.
  const trailStats = {};
  (rides || []).forEach((r) => {
    (r.ride_trails || []).forEach((rt) => {
      const s = trailStats[rt.trail_id] || { count: 0, fastestSec: null };
      s.count++;
      if (rt.seconds_on_trail != null) {
        if (s.fastestSec == null || rt.seconds_on_trail < s.fastestSec) s.fastestSec = rt.seconds_on_trail;
      }
      trailStats[rt.trail_id] = s;
    });
  });
  const riddenTrails = (trails || [])
    .filter((t) => trailStats[t.id])
    .map((t) => ({ ...t, ...trailStats[t.id] }))
    .sort((a, b) => b.count - a.count);

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
        <div className="flex gap-2 flex-wrap">
          <a href="/rides/new" className="btn-primary text-sm">+ Log a ride</a>
          <a href="/trails/discover" className="btn-ghost text-sm">🌍 Discover trails</a>
        </div>
      </div>
      <p className="text-[var(--muted)] mb-6">
        Strava rides import automatically and trails auto-populate via GPS. Click any ride for per-trail breakdown.
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

      {/* Trails ridden — word cloud */}
      {riddenTrails.length > 0 && (
        <section className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Trails you've ridden</h2>
            <span className="text-xs text-[var(--muted)]">size = how often you ride it</span>
          </div>
          <TrailCloud trails={riddenTrails} />
        </section>
      )}

      {/* Recent rides */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-3">Recent rides</h2>
        {!rides || rides.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No rides logged yet. Sync from Strava or tap "Log a ride".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Distance</th>
                  <th className="text-left p-2">Elev</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Trails</th>
                  <th className="text-left p-2">Notes</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => {
                  const trailCount = r.ride_trails?.length || 0;
                  return (
                    <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[var(--panel2)] cursor-pointer">
                      <td className="p-2 whitespace-nowrap"><a href={`/rides/${r.id}`} className="block">{r.date}</a></td>
                      <td className="p-2"><a href={`/rides/${r.id}`} className="block">{r.km ? `${r.km} km` : "—"}</a></td>
                      <td className="p-2"><a href={`/rides/${r.id}`} className="block">{r.elev_m ? `${r.elev_m} m` : "—"}</a></td>
                      <td className="p-2"><a href={`/rides/${r.id}`} className="block">{r.minutes} min</a></td>
                      <td className="p-2"><a href={`/rides/${r.id}`} className="block">{trailCount > 0 ? `${trailCount} →` : "—"}</a></td>
                      <td className="p-2 text-[var(--muted)] max-w-xs truncate"><a href={`/rides/${r.id}`} className="block">{r.notes || ""}</a></td>
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
    </main>
  );
}
