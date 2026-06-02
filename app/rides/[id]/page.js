// /rides/[id] — detail view for a single activity. Adapts to the activity
// kind: cycling shows trails + distance; strength/yoga shows duration + HR;
// swim/paddle shows distance + time; etc.

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ActivityBadge from "@/components/ActivityBadge";
import ResyncOneRideButton from "@/components/ResyncOneRideButton";
import { sportInfo } from "@/lib/activity";

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

  const info  = sportInfo(ride.sport_type);
  const kind  = ride.activity_kind || info.kind;
  // Activity title from the notes field; falls back to the sport label.
  // Notes are stored as "<Strava name> · <City>, <State>" by the importer.
  const titleFromNotes = (ride.notes || "").split(" · ")[0]?.trim();
  const title = titleFromNotes || info.label || "Activity";
  const subtitleLoc = (ride.notes || "").split(" · ")[1]?.trim();

  const totalSeconds = (ride.minutes || 0) * 60;
  const trackedSeconds = (ride.ride_trails || []).reduce((a, rt) => a + (rt.seconds_on_trail || 0), 0);
  const untrackedSeconds = Math.max(0, totalSeconds - trackedSeconds);

  const trailRows = (ride.ride_trails || [])
    .map((rt) => ({
      ...rt,
      name: rt.trails?.name || "(deleted trail)",
      difficulty: rt.trails?.difficulty,
      length_km: rt.trails?.length_km,
    }))
    .sort((a, b) => (b.seconds_on_trail || 0) - (a.seconds_on_trail || 0));

  // Cycling activities show distance + elevation + per-trail breakdown.
  // Everything else uses a kind-aware stat set.
  const isCycle = kind === "cycle";
  const showTrails = isCycle;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader back="/trails" />

      <a href="/trails" className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-2 inline-block">← Activities</a>

      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <ActivityBadge sportType={ride.sport_type} kind={kind} size="lg" />
      </div>
      <p className="text-[var(--muted)] mb-3">
        {ride.date}{subtitleLoc ? ` · ${subtitleLoc}` : ""}
      </p>

      {ride.strava_activity_id && (
        <ResyncOneRideButton stravaActivityId={ride.strava_activity_id} />
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Time" v={`${ride.minutes ?? "—"} min`} />
        {ride.km != null && ride.km > 0 && (
          <Stat label="Distance" v={`${ride.km} km`} />
        )}
        {isCycle && (
          <Stat label="Elevation" v={ride.elev_m != null ? `${ride.elev_m} m` : "—"} />
        )}
        {ride.avg_hr != null && (
          <Stat label="Avg HR" v={`${ride.avg_hr} bpm`} sub={ride.max_hr ? `max ${ride.max_hr}` : null} />
        )}
        {ride.weighted_avg_watts != null && (
          <Stat label="NP" v={`${ride.weighted_avg_watts} W`} sub={ride.avg_watts ? `avg ${ride.avg_watts}` : null} />
        )}
        {ride.kilojoules != null && !isCycle && (
          <Stat label="Energy" v={`${ride.kilojoules} kJ`} />
        )}
        {ride.suffer_score != null && (
          <Stat label="Suffer score" v={ride.suffer_score} sub="Strava relative effort" />
        )}
        {ride.feel != null && (
          <Stat label="Feel" v={"⭐".repeat(ride.feel)} />
        )}
      </section>

      {showTrails && (
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
                      <tr key={t.trail_id}
                          className="border-t border-[var(--line)] hover:bg-[var(--panel2)] transition-colors cursor-pointer">
                        <td className="p-2 font-semibold">
                          <a href={`/trails/${t.trail_id}`}
                             className="text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                            {t.name}
                            <span className="text-xs opacity-70">→</span>
                          </a>
                        </td>
                        <td className="p-2"><a href={`/trails/${t.trail_id}`} className="block"><span className="text-xs px-2 py-0.5 rounded bg-[var(--panel2)] border border-[var(--line)]">{t.difficulty || "—"}</span></a></td>
                        <td className="p-2"><a href={`/trails/${t.trail_id}`} className="block">{t.seconds_on_trail != null ? formatTime(t.seconds_on_trail) : <span className="text-[var(--muted)]">— resync</span>}</a></td>
                        <td className="p-2"><a href={`/trails/${t.trail_id}`} className="block">{pct != null ? `${pct}%` : "—"}</a></td>
                        <td className="p-2"><a href={`/trails/${t.trail_id}`} className="block">{t.length_km != null ? `${t.length_km} km` : "—"}</a></td>
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
          {trailRows.length > 0 && (
            <p className="text-xs text-[var(--muted)] mt-3">
              Click a trail to open its profile, conditions, and your history on it.
              {trailRows.some(t => t.seconds_on_trail == null) && (
                <> Rides synced before the per-trail-time feature show "— resync" — another Strava sync re-detects them.</>
              )}
            </p>
          )}
        </section>
      )}

      {!showTrails && (
        <section className="card mb-4">
          <h2 className="text-lg font-bold mb-2">{info.label}</h2>
          <p className="text-sm text-[var(--muted)]">
            This is a {info.label.toLowerCase()} session. Trail detection only runs on cycling activities — duration, heart-rate, and effort metrics are above.
          </p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, v, sub }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}
