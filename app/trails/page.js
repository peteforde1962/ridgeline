// /trails — rides-first. Log button → /rides/new. Trails-ridden as a word cloud.

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteRow from "@/components/DeleteRow";
import StravaSyncResult from "@/components/StravaSyncResult";
import TrailCloud from "@/components/TrailCloud";
import ConditionBadge from "@/components/ConditionBadge";
import AddConditionForm from "@/components/AddConditionForm";
import Icon from "@/lib/icons";
import ActivityBadge from "@/components/ActivityBadge";

export default async function TrailsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: trails }, { data: rides }, { data: conditionsAll }] = await Promise.all([
    supabase.from("trails").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("rides")
      .select("id, date, km, elev_m, minutes, notes, sport_type, activity_kind, ride_trails(trail_id, seconds_on_trail)")
      .eq("user_id", user.id)
      .order("date", { ascending: false }).limit(25),
    // Latest 50 condition reports (community-wide).
    supabase.from("trail_conditions")
      .select("trail_name, region, status, notes, reporter_name, reported_at")
      .order("reported_at", { ascending: false }).limit(50),
  ]);

  // Map: lowercase trail name → latest condition report
  const latestByTrail = {};
  for (const c of (conditionsAll || [])) {
    const k = c.trail_name.toLowerCase();
    if (!latestByTrail[k]) latestByTrail[k] = c;
  }

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
    .map((t) => {
      const cond = latestByTrail[t.name.toLowerCase()];
      const daysAgo = cond ? Math.floor((Date.now() - new Date(cond.reported_at).getTime()) / 86400_000) : null;
      return { ...t, ...trailStats[t.id], condition: cond ? { ...cond, daysAgo } : null };
    })
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
        <h1 className="text-3xl font-extrabold">Activities</h1>
        <div className="flex gap-2 flex-wrap">
          <a href="/rides/new" className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Icon name="plus" size={14} stroke="#1a2a30" /> Log activity
          </a>
          <a href="/trails/discover" className="btn-ghost text-sm inline-flex items-center gap-1.5">
            <Icon name="globe" size={14} /> Discover trails
          </a>
        </div>
      </div>
      <p className="text-[var(--muted)] mb-6">
        All Strava activities import automatically — rides, runs, hikes, swims, strength, more. Trails auto-detect on cycling activities. Click any activity for details.
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

      {/* Two-column rolladex: trail conditions + recent activities */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Trail conditions rolladex */}
        {riddenTrails.length > 0 && (
          <div className="rolladex">
            <div className="rolladex-head">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Trail conditions</h2>
              <span className="text-[10px] text-[var(--muted)]">community reports</span>
            </div>
            <div className="rolladex-body">
              {riddenTrails.map((t) => (
                <div key={t.id} className="rolladex-row">
                  <div className="flex-1 min-w-0">
                    <a href={`/trails/${t.id}`} className="font-semibold text-sm hover:underline block truncate">{t.name}</a>
                    {t.condition ? (
                      <div className="text-[11px] text-[var(--muted)] truncate">
                        {t.condition.notes ? `"${t.condition.notes}"` : "—"} · {t.condition.daysAgo}d ago
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--muted)]">No reports</div>
                    )}
                  </div>
                  {t.condition && (
                    <ConditionBadge status={t.condition.status} daysAgo={t.condition.daysAgo} title={t.condition.notes} />
                  )}
                  <AddConditionForm trailName={t.name} region={t.region} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activities rolladex */}
        <div className="rolladex">
          <div className="rolladex-head">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Recent activities</h2>
            <span className="text-[10px] text-[var(--muted)]">{rides?.length || 0} total · scroll</span>
          </div>
          <div className="rolladex-body">
            {!rides || rides.length === 0 ? (
              <p className="text-[var(--muted)] text-sm p-3">No activity yet. Sync from Strava or tap "Log activity".</p>
            ) : (
              rides.map((r) => {
                const trailCount = r.ride_trails?.length || 0;
                const activityTitle = (r.notes || "").split(" · ")[0]?.trim() || "Activity";
                return (
                  <a key={r.id} href={`/rides/${r.id}`} className="rolladex-row hover:opacity-90 transition-opacity">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <ActivityBadge sportType={r.sport_type} kind={r.activity_kind} />
                        <span className="text-[10px] text-[var(--muted)]">{r.date.slice(5)}</span>
                      </div>
                      <div className="font-semibold text-sm truncate">{activityTitle}</div>
                      <div className="text-[11px] text-[var(--muted)] truncate">
                        {r.km ? `${r.km} km · ` : ""}{r.minutes} min{r.elev_m ? ` · ${r.elev_m} m` : ""}{trailCount > 0 ? ` · ${trailCount} trails` : ""}
                      </div>
                    </div>
                    <DeleteRow table="rides" id={r.id} confirm="Delete this activity?" />
                  </a>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
