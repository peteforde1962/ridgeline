// Dashboard — disable caching so totals/charts always reflect latest data.

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex } from "@/lib/plan";
import { recoveryRecommendation } from "@/lib/recovery";
import SignOutButton from "@/components/SignOutButton";
import Icon from "@/lib/icons";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo  = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
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
    supabase.from("rides").select("id, date, km, elev_m, minutes, notes, ride_trails(trails(name))").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }),
    supabase.from("rides").select("km, minutes, elev_m, date, ride_trails(trails(name))").eq("user_id", user.id).gte("date", thirtyDaysAgo),
    supabase.from("rides").select("date, km").eq("user_id", user.id),
    supabase.from("plan_sessions").select("week_index, day_index, session_idx, completed").eq("user_id", user.id),
    supabase.from("check_ins").select("date, sleep, soreness, energy").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: true }),
  ]);

  const displayName = profile?.name || user.email?.split("@")[0] || "rider";
  const needsSetup =
    !profile ||
    (profile.name === user.email?.split("@")[0] && profile.preset === "Sport" && profile.weekly_hours === 6);

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

  const kmThisWeek    = (weekRides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const elevThisWeek  = (weekRides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);
  const minThisWeek   = (weekRides || []).reduce((a, r) => a + (+r.minutes || 0), 0);
  const ridesThisWeek = (weekRides || []).length;

  // Top trails — group monthRides by trail name (from ride_trails join).
  const trailMinutes = {};
  const trailRides   = {};
  (monthRides || []).forEach((r) => {
    (r.ride_trails || []).forEach((rt) => {
      const name = rt.trails?.name;
      if (!name) return;
      trailMinutes[name] = (trailMinutes[name] || 0) + (+r.minutes || 0) / (r.ride_trails.length || 1);
      trailRides[name]   = (trailRides[name] || 0) + 1;
    });
  });
  const topTrails = Object.keys(trailMinutes)
    .map((name) => ({ name, minutes: trailMinutes[name], rides: trailRides[name] }))
    .sort((a, b) => b.minutes - a.minutes).slice(0, 5);

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

  const readinessByDay = last7.map((dateStr) => {
    const c = (weekCheckins || []).find(c => c.date === dateStr);
    return c ? (c.sleep + c.energy - c.soreness) : null;
  });

  const recovery = recoveryRecommendation({ rides: weekRides, todayCheckin });

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

      <section className="card mb-4">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold mb-1">Hey, {displayName}</h1>
            <p className="text-[var(--muted)]">
              Week {week?.week ?? "—"} of {plan.length} · {week?.phaseName ?? "—"} phase ·
              {todayIsRest ? " rest day"
                : ` today: ${todaySessions.map(s => s.name.split("(")[0].trim()).join(", ")}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/today" className="btn-primary text-sm"><Icon name="target" size={16} stroke="#1a2a30" /> Today's workout</a>
            <a href="/checkin" className="btn-ghost text-sm"><Icon name="heart" size={16} /> Check-in</a>
            <a href="/coach" className="btn-ghost text-sm"><Icon name="bolt" size={16} /> Coach AI</a>
          </div>
        </div>
      </section>

      {needsSetup && (
        <section className="card mb-4" style={{ borderColor: "var(--accent)" }}>
          <h2 className="text-lg font-bold mb-1">Finish setting up your plan</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            Tell us about your riding so we can tailor the workouts.
          </p>
          <a href="/profile" className="btn-primary"><Icon name="cog" size={16} stroke="#1a2a30" /> Set up my profile</a>
        </section>
      )}

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

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Distance bar chart */}
        <DistanceChart kmByDay={kmByDay} maxKm={maxKm} totalKm={kmThisWeek} />


        {/* Readiness — line + points */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Readiness · last 7 days</h2>
          <ReadinessLine last7={last7} readinessByDay={readinessByDay} />
          <p className="text-[10px] text-[var(--muted)] mt-2">sleep + energy − soreness</p>
        </div>
      </section>

      {/* Recovery status */}
      <section className="card mb-4" style={{ borderLeft: `4px solid ${recovery.color}` }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-1">Recovery status</h2>
            <p className="font-bold" style={{ color: recovery.color }}>
              {recovery.status === "ready" ? "✓ Ready for a hard effort"
               : recovery.status === "almost" ? "⏳ Take it easy today"
               : "🛑 Recovering — easy or rest"}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">{recovery.label}</p>
          </div>
          {recovery.hardest && (
            <div className="text-xs text-[var(--muted)] text-right">
              <div>Hardest recent ride:</div>
              <div className="text-[var(--text)] font-semibold">{recovery.hardest.intensity}</div>
              <div>{recovery.hardest.km || "?"}km · {recovery.hardest.elev_m || "?"}m · {recovery.hardest.minutes}min</div>
            </div>
          )}
        </div>
      </section>

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
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2,#fccabb))" }} />
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
              {weekRides.slice(0, 5).map((r) => {
                const trailName = r.ride_trails?.[0]?.trails?.name || r.notes?.split("·")[0]?.trim() || "Ride";
                return (
                  <li key={r.id} className="flex justify-between text-sm">
                    <span>
                      <span className="text-[var(--muted)] mr-2">{r.date.slice(5)}</span>
                      <span className="font-semibold">{trailName}</span>
                    </span>
                    <span className="text-[var(--muted)]">{r.km}km · {r.minutes}min · {r.elev_m || 0}m</span>
                  </li>
                );
              })}
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
      <div className={`text-2xl font-extrabold ${accent ? "text-[var(--accent)]" : ""}`}>{v}</div>
      {pct != null && (
        <div className="h-1 rounded-full mt-2" style={{ background: "var(--bg2)" }}>
          <div className="h-full rounded-full" style={{
            width: `${Math.min(100, pct)}%`,
            background: pct >= 100
              ? "linear-gradient(90deg, var(--green), #95b890)"
              : "linear-gradient(90deg, var(--accent), var(--accent2,#fccabb))",
          }} />
        </div>
      )}
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

function MiniMetric({ label, v, invert }) {
  const tone = invert
    ? (v <= 3 ? "#5cb85c" : v >= 8 ? "#d9534f" : "var(--text)")
    : (v >= 8 ? "#5cb85c" : v <= 3 ? "#d9534f" : "var(--text)");
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color: tone }}>{v}<span className="text-sm text-[var(--muted)]">/10</span></div>
    </div>
  );
}

// SVG bar chart for distance with axis labels + grid lines + total.
function DistanceChart({ kmByDay, maxKm, totalKm }) {
  const W = 340, H = 150, padX = 30, padY = 14, padBottom = 22;
  // Round max up to a clean tick number (5, 10, 20, 50, etc.)
  const ceilNice = (n) => {
    if (n <= 5) return 5;
    if (n <= 10) return 10;
    if (n <= 20) return 20;
    if (n <= 50) return 50;
    if (n <= 100) return 100;
    return Math.ceil(n / 50) * 50;
  };
  const yMax = ceilNice(maxKm);
  const yTicks = [yMax, yMax / 2, 0];
  const x = (i) => padX + (i / 7) * (W - padX - 6) + (W - padX - 6) / 14;
  const barW = (W - padX - 6) / 7 - 6;
  const y = (v) => padY + (1 - v / yMax) * (H - padY - padBottom);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Distance · last 7 days</h2>
        <div className="text-xs">
          <span className="text-[var(--muted)] mr-2">Total</span>
          <span className="font-extrabold text-[var(--text)]">{totalKm.toFixed(1)} km</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="distGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="var(--accent)"  stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* grid lines + y-axis labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padX} y1={y(t)} x2={W - 6} y2={y(t)} stroke="var(--line)" strokeWidth="0.5" strokeDasharray={t === 0 ? "0" : "2,3"} />
            <text x={padX - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {/* bars */}
        {kmByDay.map((d, i) => {
          const bh = d.km > 0 ? (H - padY - padBottom) * (d.km / yMax) : 0;
          const by = y(d.km > 0 ? d.km : 0);
          return (
            <g key={d.date}>
              {d.km > 0 ? (
                <>
                  <rect
                    x={x(i) - barW / 2}
                    y={by}
                    width={barW}
                    height={Math.max(2, bh)}
                    rx="3"
                    fill="url(#distGradient)"
                  >
                    <title>{d.km.toFixed(1)} km</title>
                  </rect>
                  <text x={x(i)} y={by - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)">
                    {d.km.toFixed(d.km < 10 ? 1 : 0)}
                  </text>
                </>
              ) : (
                <circle cx={x(i)} cy={H - padBottom - 2} r="2" fill="var(--line)" />
              )}
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// SVG line + point chart for readiness.
function ReadinessLine({ last7, readinessByDay }) {
  const W = 320, H = 110, padX = 20, padY = 14;
  const max = 20, min = -10;
  function y(v) { return padY + ((max - v) / (max - min)) * (H - 2 * padY); }
  function x(i) { return padX + (i / 6) * (W - 2 * padX); }

  // Build path between consecutive non-null points.
  const segments = [];
  let lastIdx = -1;
  for (let i = 0; i < 7; i++) {
    const v = readinessByDay[i];
    if (v == null) continue;
    if (lastIdx >= 0) segments.push([lastIdx, i]);
    lastIdx = i;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* axis line */}
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--line)" />
      {/* segments */}
      {segments.map(([a, b], i) => (
        <line key={i}
              x1={x(a)} y1={y(readinessByDay[a])}
              x2={x(b)} y2={y(readinessByDay[b])}
              stroke="var(--accent)" strokeWidth="2" />
      ))}
      {/* points */}
      {readinessByDay.map((v, i) => v == null ? null : (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4"
                  fill={v <= 3 ? "#d9534f" : v >= 8 ? "#5cb85c" : "var(--accent)"}
                  stroke="var(--panel)" strokeWidth="2" />
          <text x={x(i)} y={y(v) - 9} textAnchor="middle" fontSize="10" fill="var(--muted)">{v}</text>
        </g>
      ))}
      {/* day labels */}
      {last7.map((d, i) => (
        <text key={i} x={x(i)} y={H + 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {new Date(d).toLocaleDateString(undefined, { weekday: "short" })}
        </text>
      ))}
    </svg>
  );
}
