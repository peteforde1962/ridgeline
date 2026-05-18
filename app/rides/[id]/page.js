// /rides/[id] — detail view for a single ride. Shows ride stats + per-trail breakdown.

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";

function formatTime(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function RideDetailPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ride } = await supabase
    .from("rides")
    .select("*, ride_trails(trail_id, seconds_on_trail, points_on_trail, trails(id, name, length_km, elev_m, difficulty))")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ride) notFound();

  const totalSeconds = (ride.minutes || 0) * 60;
  const trackedSeconds = (ride.ride_trails || []).reduce((a, rt) => a + (rt.seconds_on_trail || 0), 0);
  const untrackedSeconds = Math.max(0, totalSeconds - trackedSeconds);

  // Sort trails by time on trail descending.
  const trailRows = (ride.ride_trails || [])
    .map((rt) => ({
      ...rt,
      name: rt.trails?.name || "(deleted trail)",
      difficulty: rt.trails?.difficulty,
      length_km: rt.trails?.length_km,
    }))
    .sort((a, b) => (b.seconds_on_trail || 0) - (a.seconds_on_trail || 0));

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader back="/trails" />

      <a href="/trails" className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-2 inline-block">← Trails &amp; Rides</a>

      <h1 className="text-3xl font-extrabold mb-1">{ride.date}</h1>
      <p className="text-[var(--muted)] mb-6">{ride.notes || "Ride details"}</p>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Distance"   v={ride.km != null ? `${ride.km} km` : "—"} />
        <Stat label="Elevation"  v={ride.elev_m != null ? `${ride.elev_m} m` : "—"} />
        <Stat label="Time"       v={`${ride.minutes ?? "—"} min`} />
        <Stat label="Feel"       v={ride.feel ? "⭐".repeat(ride.feel) : "—"} />
      </section>

      <section className="card mb-4">
        <h2 className="text-lg font-bold mb-3">Trails ridden ({trailRows.length})</h2>
        {trailRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No trails detected for this ride.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Trail</th>
                  <th className="text-left p-2">Difficulty</th>
                  <th className="text-left p-2">Time on trail</th>
                  <th className="text-left p-2">% of ride</th>
                  <th className="text-left p-2">Trail length</th>
                </tr>
              </thead>
              <tbody>
                {trailRows.map((t) => {
                  const pct = totalSeconds > 0 && t.seconds_on_trail
                    ? Math.round((t.seconds_on_trail / totalSeconds) * 100)
                    : null;
                  return (
                    <tr key={t.trail_id} className="border-t border-[var(--line)]">
                      <td className="p-2 font-semibold">{t.name}</td>
                      <td className="p-2"><span className="text-xs px-2 py-0.5 rounded bg-[var(--panel2)] border border-[var(--line)]">{t.difficulty || "—"}</span></td>
                      <td className="p-2">{t.seconds_on_trail != null ? formatTime(t.seconds_on_trail) : <span className="text-[var(--muted)]">— resync</span>}</td>
                      <td className="p-2">{pct != null ? `${pct}%` : "—"}</td>
                      <td className="p-2">{t.length_km != null ? `${t.length_km} km` : "—"}</td>
                    </tr>
                  );
                })}
                {untrackedSeconds > 0 && trackedSeconds > 0 && (
                  <tr className="border-t border-[var(--line)]">
                    <td className="p-2 italic text-[var(--muted)]">Connectors / fire roads / between trails</td>
                    <td className="p-2">—</td>
                    <td className="p-2 italic text-[var(--muted)]">{formatTime(untrackedSeconds)}</td>
                    <td className="p-2 italic text-[var(--muted)]">{Math.round((untrackedSeconds / totalSeconds) * 100)}%</td>
                    <td className="p-2">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {trailRows.some(t => t.seconds_on_trail == null) && (
          <p className="text-xs text-[var(--muted)] mt-3">
            ⓘ Per-trail times are estimated from your GPS polyline. Rides synced before the per-trail-time feature show "— resync" — running another Strava sync re-detects them.
          </p>
        )}
      </section>
    </main>
  );
}

function Stat({ label, v }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
    </div>
  );
}
