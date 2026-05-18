// Dashboard — Grafana-style data view.
// Hero header + today's status, then KPI snapshot, this-week chart, top trails,
// recent activity timeline.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex } from "@/lib/plan";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: todayCheckin },
    { data: weekRides },
    { data: monthRides },
    { data: allRides },
    { data: planSessions },
    { data: weekCheckins },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("check_ins").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("rides").select("*, trails(name)").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }),
    supabase.from("rides").select("trail_id, trails(name), km, minutes, elev_m, date").eq("user_id", user.id).gte("date", thirtyDaysAgo),
    supabase.from("rides").select("date, km").eq("user_id", user.id),
    supabase.from("plan_sessions").select("week_index, day_index, session_idx, completed").eq("user_id", user.id),
    supabase.from("check_ins").select("date, sleep, soreness, energy").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: true }),
  ]);

  const displayName = profile?.name || user.email?.split("@")[0] || "rider";
  const needsSetup =
    !profile ||
    (profile.name === user.email?.split("@")[0] && profile.preset === "Sport" && profile.weekly_hours === 6);

  // -------- Plan stats --------
  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex();
  const week = plan[wIdx];
  const todaySessions = week?.days?.[dIdx]?.details || [];
  const todayIsRest = todaySessions.length === 0;

  const completedThisWeek = (planSessions || []).filter(s => s.week_index === wIdx && s.completed).length;
  const scheduledThisWeek = week
    ? week.days.reduce((a, d) => a + d.details.filter(s => s.type !== "rest").length, 0)
    : 0;
  const overallDone = (planSessions || []).filter(s => s.completed).length;
  const totalScheduled = plan.reduce((a, w) => a + w.days.reduce((b, d) => b + d.details.filter(s => s.type !== "rest").length, 0), 0);

  // -------- Week KPIs --------
  const kmThisWeek    = (weekRides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const elevThisWeek  = (weekRides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);
  const minThisWeek   = (weekRides || []).reduce((a, r) => a + (+r.minutes || 0), 0);
  const ridesThisWeek = (weekRides || []).length;

  // -------- Top trails (last 30d) --------
  const trailMinutes = {};
  const trailRides   = {};
  (monthRides || []).forEach((r) => {
    if (!r.trails?.name) return;
    trailMinutes[r.trails.name] = (trailMinutes[r.trails.name] || 0) + (+r.minutes || 0);
    trailRides[r.trails.name]   = (trailRides[r.trails.name] || 0) + 1;
  });
  const topTrails = Object.keys(trailMinutes)
    .map((name) => ({ name, minutes: trailMinutes[name], rides: trailRides[name] }))
    .sort((a, b) => b.minutes - a.minutes).slice(0, 5);

  // -------- 7-day activity chart (km per day) --------
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const kmByDay = last7.map((dateStr) => ({
    date: dateStr,
    km: (allRides || []).filter(r => r.date === dateStr).reduce((a, r) => a + (+r.km || 0), 0),
  }));
  const maxKm = Math.max(1, ...kmByDay.map(d => d.km));

  // -------- Readiness line (7-day) --------
  const readinessByDay = last7.map((dateStr) => {
    const c = (weekCheckins || []).find(c => c.date === dateStr);
    return c ? (c.sleep + c.energy - c.soreness) : null;
  });

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="flex items-center gap-3 hover:opacity-80 md:hidden">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-xl">RidgeLine</div>
        </a>
        <div className="ml-auto"><SignOutButton /></div>
      </header>

      {/* Hero — name + today's status */}
      <section className="card mb-4">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold mb-1">Hey, {displayName}</h1>
            <p className="text-[var(--muted)]">
              Week {week?.week ?? "—"} of {plan.length} · {week?.phaseName ?? "—"} phase ·
              {todayIsRest ? " 🛌 today is a rest day"
                : ` 🎯 today: ${todaySessions.map(s => s.name.split("(")[0].trim()).join(", ")}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/today" className="btn-primary text-sm">Today's workout →</a>
            <a href="/checkin" className="btn-ghost text-sm">💚 Check-in</a>
            <a href="/coach" className="btn-ghost text-sm">🤖 Coach AI</a>
          </div>
        </div>
      </section>

      {needsSetup && (
        <section className="card mb-4" style={{ borderColor: "var(--accent)" }}>
          <h2 className="text-lg font-bold mb-1">👋 Finish setting up your plan</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            Tell us about your riding so we can tailor the workouts.
          </p>
          <a href="/profile" className="btn-primary">Set up my profile</a>
        </section>
      )}

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="This week sessions"
             v={`${completedThisWeek}/${scheduledThisWeek}`}
             pct={scheduledThisWeek ? Math.round(100 * completedThisWeek / scheduledThisWeek) : 0}
             accent />
        <Kpi label="Plan progress"
             v={`${overallDone}/${totalScheduled}`}
             pct={totalScheduled ? Math.round(100 * overallDone / totalScheduled) : 0} />
        <Kpi label="Distance (7d)" v={`${kmThisWeek.toFixed(1)} km`} sub={`${ridesThisWeek} ride${ridesThisWeek === 1 ? "" : "s"}`} />
        <Kpi label="Climbing (7d)" v={`${elevThisWeek.toLocaleString()} m`} sub={`${Math.round(minThisWeek / 60)} hr saddle`} />
      </section>

      {/* Two-column: chart + readiness */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Chart: km per day, last 7 */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Distance · last 7 days</h2>
          <div className="flex items-end gap-2 h-32">
            {kmByDay.map((d, i) => {
              const h = d.km > 0 ? Math.max(4, (d.km / maxKm) * 100) : 2;
              const label = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.km.toFixed(1)} km`}>
                  <div className="text-[10px] text-[var(--muted)]">{d.km > 0 ? d.km.toFixed(0) : ""}</div>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${h}%`,
                      background: d.km > 0 ? "linear-gradient(180deg, var(--accent), var(--accent2,#d35a40))" : "var(--bg2)",
                    }}
                  />
                  <div className="text-[10px] text-[var(--muted)]">{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Readiness sparkline */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Readiness · last 7 days</h2>
          <div className="flex items-end gap-2 h-32">
            {readinessByDay.map((r, i) => {
              const v = r ?? 0;
              const max = 20;
              const h = r != null ? Math.max(6, (v / max) * 100) : 2;
              const label = new Date(last7[i]).toLocaleDateString(undefined, { weekday: "short" });
              const color = r == null ? "var(--bg2)"
                : v <= 3 ? "#d76a4a"
                : v >= 8 ? "#6a8a6d"
                : "#dcc9a9";
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={r == null ? "no check-in" : `score ${v}`}>
                  <div className="text-[10px] text-[var(--muted)]">{r != null ? v : ""}</div>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, background: color }} />
                  <div className="text-[10px] text-[var(--muted)]">{label}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--muted)] mt-2">sleep + energy − soreness</p>
        </div>
      </section>

      {/* Today's check-in (if any) */}
      {todayCheckin && (
        <section className="card mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Today's check-in</h2>
          <div className="grid grid-cols-3 gap-4">
            <MiniMetric label="Sleep"    v={todayCheckin.sleep}    />
            <MiniMetric label="Soreness" v={todayCheckin.soreness} invert />
            <MiniMetric label="Energy"   v={todayCheckin.energy}   />
          </div>
          {todayCheckin.notes && (
            <p className="text-sm text-[var(--muted)] mt-3 italic">"{todayCheckin.notes}"</p>
          )}
        </section>
      )}

      {/* Two columns: top trails + recent rides */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Top trails · last 30d</h2>
          {topTrails.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No trail-linked rides yet.</p>
          ) : (
            <ol className="space-y-2">
              {topTrails.map((t, i) => {
                const maxMin = topTrails[0].minutes;
                const pct = Math.max(8, (t.minutes / maxMin) * 100);
                return (
                  <li key={t.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span><span className="text-[var(--muted)] mr-2">#{i + 1}</span><span className="font-semibold">{t.name}</span></span>
                      <span className="text-[var(--muted)]">{t.rides} ride{t.rides === 1 ? "" : "s"} · {Math.round(t.minutes / 60)}h</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--bg2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2,#d35a40))" }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Recent rides</h2>
          {(weekRides || []).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No rides in the last 7 days.</p>
          ) : (
            <ul className="space-y-2">
              {weekRides.slice(0, 5).map((r) => (
                <li key={r.id} className="flex justify-between text-sm">
                  <span>
                    <span className="text-[var(--muted)] mr-2">{r.date.slice(5)}</span>
                    <span className="font-semibold">{r.trails?.name || r.notes?.split("·")[0] || "Untitled"}</span>
                  </span>
                  <span className="text-[var(--muted)]">{r.km}km · {r.minutes}min · {r.elev_m || 0}m</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, v, sub, pct, accent }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${accent ? "text-[var(--accent3,#dcc9a9)]" : ""}`}>{v}</div>
      {pct != null && (
        <div className="h-1 rounded-full mt-2" style={{ background: "var(--bg2)" }}>
          <div className="h-full rounded-full" style={{
            width: `${Math.min(100, pct)}%`,
            background: pct >= 100
              ? "linear-gradient(90deg, var(--green), #95b890)"
              : "linear-gradient(90deg, var(--accent), var(--accent2,#d35a40))",
          }} />
        </div>
      )}
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

function MiniMetric({ label, v, invert }) {
  const tone = invert
    ? (v <= 3 ? "#6a8a6d" : v >= 8 ? "#d76a4a" : "#dcc9a9")
    : (v >= 8 ? "#6a8a6d" : v <= 3 ? "#d76a4a" : "#dcc9a9");
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color: tone }}>{v}<span className="text-sm text-[var(--muted)]">/10</span></div>
    </div>
  );
}
