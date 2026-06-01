// /trails/[id] — trail profile page. Stats, condition history, your rides on it.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ConditionBadge from "@/components/ConditionBadge";
import AddConditionForm from "@/components/AddConditionForm";
import TrailProfileGraph from "@/components/TrailProfileGraph";

function formatTime(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function difficultyColor(d) {
  return {
    "Green":        "#5cb85c",
    "Blue":         "#5fa7c4",
    "Black":        "#2a2a2a",
    "Double Black": "#000000",
  }[d] || "var(--muted)";
}

export default async function TrailProfilePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trail } = await supabase
    .from("trails").select("*")
    .eq("id", params.id).eq("user_id", user.id)
    .maybeSingle();
  if (!trail) notFound();

  const [{ data: rideTrails }, { data: conditions }] = await Promise.all([
    supabase.from("ride_trails")
      .select("seconds_on_trail, rides(id, date, km, elev_m, minutes, source, notes, feel)")
      .eq("trail_id", params.id)
      .order("rides(date)", { ascending: false }),
    supabase.from("trail_conditions")
      .select("status, notes, reporter_name, reported_at")
      .ilike("trail_name", trail.name)
      .order("reported_at", { ascending: false })
      .limit(20),
  ]);

  const rides = (rideTrails || [])
    .filter((rt) => rt.rides)
    .map((rt) => ({ ...rt.rides, seconds_on_trail: rt.seconds_on_trail }));

  // Stats
  const rideCount    = rides.length;
  const totalSeconds = rides.reduce((a, r) => a + (r.seconds_on_trail || 0), 0);
  const fastestSec   = rides.reduce((a, r) => (r.seconds_on_trail != null && (a == null || r.seconds_on_trail < a)) ? r.seconds_on_trail : a, null);
  const lastRide     = rides[0]?.date;
  const latestCondition = conditions?.[0];

  const diffColor = difficultyColor(trail.difficulty);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader back="/trails" />
      <a href="/trails" className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-2 inline-block">← Activities</a>

      {/* Header */}
      <div className="card mb-4" style={{ borderLeft: `4px solid ${diffColor}` }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div>
            <h1 className="text-3xl font-extrabold mb-1">{trail.name}</h1>
            <div className="flex items-center gap-2 flex-wrap text-sm text-[var(--muted)]">
              {trail.region && <span>{trail.region}</span>}
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: `${diffColor}22`, color: diffColor, border: `1px solid ${diffColor}66` }}>
                {trail.difficulty || "Unrated"}
              </span>
              {latestCondition && (
                <ConditionBadge
                  status={latestCondition.status}
                  daysAgo={Math.floor((Date.now() - new Date(latestCondition.reported_at).getTime()) / 86400_000)}
                  title={latestCondition.notes}
                />
              )}
            </div>
          </div>
          <AddConditionForm trailName={trail.name} region={trail.region} />
        </div>
      </div>

      {/* Glassy trail profile graph — pops out on mount */}
      <TrailProfileGraph
        trailId={trail.id}
        name={trail.name}
        lengthKm={trail.length_km}
        elevM={trail.elev_m}
        difficulty={trail.difficulty}
      />

      {/* Stat grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Length"   v={trail.length_km != null ? `${trail.length_km} km` : "—"} />
        <Stat label="Climbing" v={trail.elev_m != null ? `${trail.elev_m} m` : "—"} />
        <Stat label="Times ridden" v={rideCount} accent />
        <Stat label="Fastest" v={formatTime(fastestSec)} />
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Total time on trail" v={`${Math.round(totalSeconds / 60)} min`} />
        <Stat label="Last ridden" v={lastRide || "—"} />
      </section>

      {/* Recent rides */}
      <section className="card mb-4">
        <h2 className="text-lg font-bold mb-3">Your rides on this trail</h2>
        {rides.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No rides logged on this trail yet.</p>
        ) : (
          <div className="space-y-2">
            {rides.slice(0, 10).map((r) => (
              <a
                key={r.id}
                href={`/rides/${r.id}`}
                className="flex items-center justify-between p-3 rounded-lg border transition hover:border-[var(--accent)]"
                style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-[#f8b6a6]/20 text-[#f8b6a6] border border-[#f8b6a6]/60">
                      {r.source === "strava" ? "Strava" : "Manual"}
                    </span>
                    <span className="font-semibold">{r.date}</span>
                    {r.seconds_on_trail != null && (
                      <span className="text-xs text-[var(--muted)]">
                        {formatTime(r.seconds_on_trail)} on trail
                      </span>
                    )}
                    {r.feel != null && <span className="text-xs">{"⭐".repeat(r.feel)}</span>}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {r.km}km · {r.minutes}min total · {r.elev_m || 0}m climb
                  </div>
                </div>
                <span className="text-[var(--muted)] ml-3">→</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Condition history */}
      <section className="card">
        <h2 className="text-lg font-bold mb-3">Conditions history</h2>
        {(!conditions || conditions.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No condition reports for this trail yet.</p>
        ) : (
          <ul className="space-y-2">
            {conditions.map((c, i) => {
              const daysAgo = Math.floor((Date.now() - new Date(c.reported_at).getTime()) / 86400_000);
              return (
                <li key={i} className="flex items-center gap-3 flex-wrap py-2 border-b border-[var(--line)] last:border-0">
                  <ConditionBadge status={c.status} />
                  <span className="text-xs text-[var(--muted)]">
                    {c.reporter_name || "anon"} · {daysAgo}d ago
                  </span>
                  {c.notes && <span className="text-sm">"{c.notes}"</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, v, accent }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${accent ? "text-[var(--accent)]" : ""}`}>{v}</div>
    </div>
  );
}
