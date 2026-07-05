// Dashboard — disable caching so totals/charts always reflect latest data.

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex, todayDateInTz } from "@/lib/plan";
import { recoveryRecommendation } from "@/lib/recovery";
import { trainingLoadSeries, currentLoad, formInterpretation } from "@/lib/training-load";
import SignOutButton from "@/components/SignOutButton";
import Icon from "@/lib/icons";
import ActivityBadge from "@/components/ActivityBadge";
import LogoMark from "@/components/LogoMark";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load profile first so we know the user's timezone before computing "today".
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const today = todayDateInTz(profile?.timezone);
  const sevenDaysAgo  = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [
    { data: todayCheckin },
    { data: weekRides },
    { data: monthRides },
    { data: allRides },
    { data: planSessions },
    { data: weekCheckins },
  ] = await Promise.all([
    supabase.from("check_ins").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("rides").select("id, date, km, elev_m, minutes, notes, sport_type, activity_kind, ride_trails(trails(name))").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }),
    supabase.from("rides").select("km, minutes, elev_m, date, ride_trails(trails(name))").eq("user_id", user.id).gte("date", thirtyDaysAgo),
    supabase.from("rides")
      .select("date, km, elev_m, minutes, avg_hr, avg_watts, weighted_avg_watts, suffer_score")
      .eq("user_id", user.id),
    supabase.from("plan_sessions").select("week_index, day_index, session_idx, completed").eq("user_id", user.id),
    supabase.from("check_ins").select("date, sleep, soreness, energy").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: true }),
  ]);

  const displayName = profile?.name || user.email?.split("@")[0] || "rider";
  const needsSetup =
    !profile ||
    (profile.name === user.email?.split("@")[0] && profile.preset === "Sport" && profile.weekly_hours === 6);

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex(profile?.timezone);
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

  // Training load — 60-day series and current values. Pass profile so FTP/LTHR
  // get used when present; ride data we just selected includes the intensity cols.
  const loadSeries = trainingLoadSeries(allRides || [], 60, profile);
  const load = currentLoad(loadSeries);
  const form = formInterpretation(load.form);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="flex items-center gap-3 hover:opacity-80 md:hidden">
          <LogoMark size={32} />
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
        <div className="card-glass">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Readiness · last 7 days</h2>
          <ReadinessLine last7={last7} readinessByDay={readinessByDay} />
          <p className="text-[10px] text-[var(--muted)] mt-2">sleep + energy − soreness</p>
        </div>
      </section>

      {/* Activity mix — stacked bars by kind, last 7 days */}
      <ActivityMixCard rides={weekRides || []} last7={last7} />

      {/* Training Load (TrainingPeaks-style) */}
      <section className="card-glass mb-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            Training load · <a href="/training-load" className="text-[var(--accent)] normal-case font-normal">detail →</a>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${form.color}22`, color: form.color, border: `1px solid ${form.color}66` }}>
            {form.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <LoadStat label="Fitness (CTL)"  v={load.fitness} sub="42-day avg" color="#5fa7c4" />
          <LoadStat label="Fatigue (ATL)"  v={load.fatigue} sub="7-day avg"  color="#f0ad4e" />
          <LoadStat label="Form (TSB)"     v={load.form}    sub="fitness − fatigue" color={form.color} />
        </div>
        <TrainingLoadChart series={loadSeries} />
        <p className="text-[10px] text-[var(--muted)] mt-2">
          Hover labels for definitions. Fatigue (ATL) and Form (TSB) move opposite each other by design — Form = Fitness − Fatigue, so when fatigue spikes, form drops. The shaded zones above the dashed line are "fresh", below are "fatigued".
        </p>
      </section>

      {/* Recovery + Heatmap + Recent activity — compact 3-column row.
          On mobile they stack. Recovery is the compact left card, heatmap is
          the visual middle showing 90 days at a glance, and recent activity
          keeps the day-by-day list on the right. */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Recovery status — compact */}
        <div className="card" style={{ borderLeft: `4px solid ${recovery.color}` }}>
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1">Recovery status</h2>
          <p className="font-bold text-sm" style={{ color: recovery.color }}>
            {recovery.status === "ready" ? "✓ Ready for a hard effort"
             : recovery.status === "almost" ? "⏳ Take it easy today"
             : "🛑 Recovering — easy or rest"}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">{recovery.label}</p>
          {recovery.hardest && (
            <div className="text-[11px] text-[var(--muted)] mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
              <div>Hardest recent: <span className="text-[var(--text)] font-semibold">{recovery.hardest.intensity}</span></div>
              <div>{recovery.hardest.km || "?"}km · {recovery.hardest.elev_m || "?"}m · {recovery.hardest.minutes}min</div>
            </div>
          )}
        </div>

        {/* Activity heatmap — GitHub-style 90-day grid, cells colored by daily minutes. */}
        <ActivityHeatmap rides={allRides || []} />

        {/* Recent activity — the same list that used to live at the bottom
            of the page, now inline with Recovery + Heatmap. */}
        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Recent activity</h2>
          {(weekRides || []).length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No activity in the last 7 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {weekRides.slice(0, 5).map((r) => {
                const trailName = r.ride_trails?.[0]?.trails?.name || r.notes?.split("·")[0]?.trim() || "Activity";
                return (
                  <li key={r.id} className="flex justify-between text-xs gap-2">
                    <span className="flex items-center gap-1.5 min-w-0 flex-1">
                      <ActivityBadge sportType={r.sport_type} kind={r.activity_kind} />
                      <span className="text-[var(--muted)]">{r.date.slice(5)}</span>
                      <span className="font-semibold truncate">{trailName}</span>
                    </span>
                    <span className="text-[var(--muted)] whitespace-nowrap">{r.km}km · {r.minutes}m</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {todayCheckin && (
        <section className="card-glass mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Today's check-in</h2>
          <div className="grid grid-cols-3 gap-2">
            <GaugeDial label="Sleep"    value={todayCheckin.sleep}    />
            <GaugeDial label="Soreness" value={todayCheckin.soreness} invert />
            <GaugeDial label="Energy"   value={todayCheckin.energy}   />
          </div>
          {todayCheckin.notes && (
            <p className="text-sm text-[var(--muted)] mt-3 italic">"{todayCheckin.notes}"</p>
          )}
        </section>
      )}

      {/* Top trails — now full-width (Recent activity moved up beside Recovery). */}
      <section className="card-glass mb-4">
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

// Semi-circular gauge dial — minimal, in keeping with the rest of the site.
// Thin arc, slim needle, restrained color, value typeset rather than blocky.
function GaugeDial({ label, value, max = 10, invert = false }) {
  const W = 160, H = 100, cx = W / 2, cy = H - 14, r = 56;
  const t = Math.min(1, Math.max(0, value / max));
  const angle = Math.PI - t * Math.PI; // π (left) → 0 (right)

  // Tier-based color — muted versions to match the site's palette.
  const goodVal = invert ? value <= 3 : value >= 8;
  const badVal  = invert ? value >= 8 : value <= 3;
  const color   = goodVal ? "#7fb582" : badVal ? "#d6857f" : "var(--accent)";

  const x1 = cx + r * Math.cos(Math.PI),  y1 = cy - r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(0),         y2 = cy - r * Math.sin(0);
  const fx = cx + r * Math.cos(angle),     fy = cy - r * Math.sin(angle);
  const nx = cx + (r - 3) * Math.cos(angle), ny = cy - (r - 3) * Math.sin(angle);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* background arc — thin, low-contrast */}
        <path
          d={`M${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
          fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" strokeLinecap="round"
        />
        {/* filled arc — same thin stroke for consistency */}
        <path
          d={`M${x1} ${y1} A ${r} ${r} 0 0 1 ${fx} ${fy}`}
          fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        />
        {/* slim needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
              stroke="var(--muted)" strokeWidth="1.25" strokeLinecap="round" opacity="0.85" />
        {/* small dot at hub */}
        <circle cx={cx} cy={cy} r="2" fill={color} />
        {/* value text — restrained, lighter weight */}
        <text x={cx} y={cy - 16} textAnchor="middle"
              fontSize="20" fontWeight="700" fill="var(--text)" letterSpacing="-0.5">
          {value}<tspan fontSize="11" fill="var(--muted)" fontWeight="500"> / {max}</tspan>
        </text>
      </svg>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold -mt-2">{label}</div>
    </div>
  );
}

const LOAD_TIPS = {
  "Fitness (CTL)":  "Chronic Training Load — slow-moving baseline of your overall conditioning.",
  "Fatigue (ATL)":  "Acute Training Load — short-term tiredness from recent hard sessions.",
  "Form (TSB)":     "Fitness − Fatigue. Positive = fresh & ready. Negative = loading or under-recovered.",
};

function LoadStat({ label, v, sub, color }) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] flex items-center gap-1">
          {label}
          <span className="text-[var(--muted)] opacity-60 group-open:text-[var(--accent)] group-open:opacity-100">ⓘ</span>
        </div>
        <div className="text-2xl font-extrabold" style={{ color }}>{v.toFixed(1)}</div>
        <div className="text-[10px] text-[var(--muted)]">{sub}</div>
      </summary>
      <p className="text-[10px] text-[var(--muted)] mt-1 italic">{LOAD_TIPS[label]}</p>
    </details>
  );
}

function TrainingLoadChart({ series }) {
  const W = 600, H = 130, padX = 30, padY = 10, padBottom = 18;
  if (!series || series.length === 0) {
    return <div className="text-sm text-[var(--muted)] py-4 text-center">No ride data yet.</div>;
  }
  const allVals = [...series.map(s => s.ctl), ...series.map(s => s.atl), ...series.map(s => s.tsb)];
  const yMin = Math.min(0, Math.floor(Math.min(...allVals) - 5));
  const yMax = Math.max(10, Math.ceil(Math.max(...allVals) + 5));
  const x = (i) => padX + (i / (series.length - 1)) * (W - padX - 6);
  const y = (v) => padY + ((yMax - v) / (yMax - yMin)) * (H - padY - padBottom);

  function path(key) {
    return series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[key])}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* Freshness zones (only meaningful in form/TSB space) */}
      {yMin < 0 && yMax > 0 && (
        <>
          {/* Positive zone — fresh */}
          <rect x={padX} y={y(yMax)} width={W - padX - 6} height={y(0) - y(yMax)}
                fill="#5cb85c" opacity="0.05" />
          {/* Negative zone — fatigued */}
          <rect x={padX} y={y(0)} width={W - padX - 6} height={y(yMin) - y(0)}
                fill="#d9534f" opacity="0.05" />
        </>
      )}
      {/* zero line if in range */}
      {yMin < 0 && yMax > 0 && (
        <line x1={padX} y1={y(0)} x2={W - 6} y2={y(0)} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3,3" />
      )}
      {/* Y axis tick at top */}
      <text x={padX - 6} y={padY + 4} textAnchor="end" fontSize="9" fill="var(--muted)">{yMax}</text>
      <text x={padX - 6} y={H - padBottom + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{yMin}</text>
      {/* CTL — fitness (blue) */}
      <path d={path("ctl")} fill="none" stroke="#5fa7c4" strokeWidth="2" />
      {/* ATL — fatigue (amber) */}
      <path d={path("atl")} fill="none" stroke="#f0ad4e" strokeWidth="2" strokeDasharray="4,2" />
      {/* TSB — form (peach) */}
      <path d={path("tsb")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {/* date labels: first + last */}
      <text x={padX} y={H - 4} textAnchor="start" fontSize="9" fill="var(--muted)">
        {new Date(series[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </text>
      <text x={W - 6} y={H - 4} textAnchor="end" fontSize="9" fill="var(--muted)">
        Today
      </text>
      {/* legend */}
      <g transform={`translate(${padX + 4}, ${padY + 4})`}>
        <rect width="3" height="3" y="0" fill="#5fa7c4" /><text x="6" y="3" fontSize="9" fill="var(--muted)">Fitness</text>
        <rect width="3" height="3" y="8" fill="#f0ad4e" /><text x="6" y="11" fontSize="9" fill="var(--muted)">Fatigue</text>
        <rect width="3" height="3" y="16" fill="#f8b6a6" /><text x="6" y="19" fontSize="9" fill="var(--muted)">Form</text>
      </g>
    </svg>
  );
}

// Brand color per activity kind. Harmonized with the dark teal + peach palette.
const KIND_COLOR = {
  cycle:    "#f8b6a6",   // peach — flagship
  run:      "#e3a87d",   // warm amber
  hike:     "#b8a48d",   // warm tan
  swim:     "#5fa7c4",   // teal blue
  ski:      "#c5d8e0",   // ice
  paddle:   "#88c4c5",   // sea green
  strength: "#7fb582",   // soft green
  yoga:     "#b694c4",   // soft lavender
  rope:     "#f0ad4e",   // amber
  climb:    "#a17e6b",   // sienna
  other:    "#a7bcc4",   // muted teal-gray
};
const KIND_LABEL = {
  cycle:    "Ride",
  run:      "Run",
  hike:     "Hike",
  swim:     "Swim",
  ski:      "Snow",
  paddle:   "Paddle",
  strength: "Strength",
  yoga:     "Yoga",
  rope:     "Rope",
  climb:    "Climb",
  other:    "Other",
};
// Render order so flagship cycling sits at the bottom of each stack.
const KIND_ORDER = ["cycle", "run", "hike", "swim", "ski", "paddle", "strength", "yoga", "rope", "climb", "other"];

function ActivityMixCard({ rides, last7 }) {
  // Aggregate minutes by (date, kind) from the ride rows we already have.
  const byDay = last7.map((dateStr) => {
    const minutes = {};
    for (const r of rides) {
      if (r.date !== dateStr) continue;
      const k = r.activity_kind || "other";
      minutes[k] = (minutes[k] || 0) + (+r.minutes || 0);
    }
    const total = Object.values(minutes).reduce((a, b) => a + b, 0);
    return { date: dateStr, minutes, total };
  });

  // Weekly per-kind totals for the legend.
  const weekly = {};
  for (const r of rides) {
    const k = r.activity_kind || "other";
    weekly[k] = (weekly[k] || 0) + (+r.minutes || 0);
  }
  const kindsPresent = KIND_ORDER.filter((k) => (weekly[k] || 0) > 0);
  const totalMin = Object.values(weekly).reduce((a, b) => a + b, 0);

  return (
    <section className="card-glass mb-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Activity mix · last 7 days</h2>
        <div className="text-xs">
          <span className="text-[var(--muted)] mr-2">Total</span>
          <span className="font-extrabold text-[var(--text)]">
            {Math.floor(totalMin / 60)}h {totalMin % 60}m
          </span>
        </div>
      </div>
      <ActivityMixChart byDay={byDay} />
      {kindsPresent.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
          {kindsPresent.map((k) => {
            const mins = weekly[k] || 0;
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11px]">
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: KIND_COLOR[k] }} />
                <span className="text-[var(--text)] font-semibold">{KIND_LABEL[k]}</span>
                <span className="text-[var(--muted)]">
                  {mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {totalMin === 0 && (
        <p className="text-sm text-[var(--muted)] text-center mt-3">No activity recorded in the last 7 days.</p>
      )}
    </section>
  );
}

function ActivityMixChart({ byDay }) {
  const W = 700, H = 160, padX = 36, padY = 14, padBottom = 22;
  const maxTotal = Math.max(1, ...byDay.map((d) => d.total));
  // Round max up to a clean tick number.
  function ceilNice(n) {
    if (n <= 30)   return 30;
    if (n <= 60)   return 60;
    if (n <= 120)  return 120;
    if (n <= 240)  return 240;
    if (n <= 360)  return 360;
    return Math.ceil(n / 60) * 60;
  }
  const yMax = ceilNice(maxTotal);
  const yTicks = [yMax, Math.round(yMax / 2), 0];
  const innerW = W - padX - 6;
  const innerH = H - padY - padBottom;
  const x = (i) => padX + (i / 7) * innerW + innerW / 14;
  const barW = innerW / 7 - 10;
  const y = (v) => padY + (1 - v / yMax) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* grid lines + y-axis (in minutes) */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padX} y1={y(t)} x2={W - 6} y2={y(t)}
                stroke="var(--line)" strokeWidth="0.5" strokeDasharray={t === 0 ? "0" : "2,3"} />
          <text x={padX - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
            {t >= 60 ? `${Math.floor(t/60)}h` : `${t}m`}
          </text>
        </g>
      ))}
      {byDay.map((d, i) => {
        let stackY = y(0);  // start from the baseline
        const segments = [];
        for (const k of KIND_ORDER) {
          const mins = d.minutes[k] || 0;
          if (mins === 0) continue;
          const segH = innerH * (mins / yMax);
          const top  = stackY - segH;
          segments.push({ kind: k, mins, top, h: segH });
          stackY -= segH;
        }
        return (
          <g key={d.date}>
            {segments.length === 0 ? (
              <circle cx={x(i)} cy={H - padBottom - 2} r="2" fill="var(--line)" />
            ) : segments.map((s, j) => {
              const isTop = j === segments.length - 1;
              // Round top corners only on the top-most segment for a nice pill.
              const rx = isTop ? 3 : 0;
              return (
                <rect key={s.kind}
                      x={x(i) - barW / 2} y={s.top}
                      width={barW} height={Math.max(2, s.h)}
                      rx={rx}
                      fill={KIND_COLOR[s.kind]}>
                  <title>{`${KIND_LABEL[s.kind]}: ${s.mins}m`}</title>
                </rect>
              );
            })}
            {d.total > 0 && (
              <text x={x(i)} y={y(d.total) - 4} textAnchor="middle"
                    fontSize="9" fontWeight="700" fill="var(--text)">
                {d.total >= 60 ? `${Math.floor(d.total/60)}h${d.total%60 ? d.total%60 + "m" : ""}` : `${d.total}m`}
              </text>
            )}
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
            </text>
          </g>
        );
      })}
    </svg>
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
    <div className="card-glass">
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

// GitHub-style contribution graph but for activity minutes.
// 90-day rolling window, columns = weeks (Mon anchor), rows = days of week.
// Cell intensity scales with total minutes on that day.
function ActivityHeatmap({ rides }) {
  const DAYS = 90;
  // Cell + spacing sizing (SVG units).
  const CELL = 12, GAP = 3, LEFT_PAD = 18, TOP_PAD = 14;

  // Snap start to the Monday of the week containing (today - 89 days).
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (DAYS - 1));
  const dowOffset = (start.getDay() + 6) % 7; // 0=Mon..6=Sun
  start.setDate(start.getDate() - dowOffset);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = Math.floor((today - start) / 86400_000) + 1;
  const weeks = Math.ceil(totalDays / 7);

  // Sum minutes per date across all rides (all activity types).
  const minutesByDate = {};
  for (const r of (rides || [])) {
    minutesByDate[r.date] = (minutesByDate[r.date] || 0) + (+r.minutes || 0);
  }

  // Build cell array.
  const cells = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({
      dateStr,
      week: Math.floor(i / 7),
      dow: i % 7,
      minutes: minutesByDate[dateStr] || 0,
      // Include future padding cells (past today) as invisible.
      isFuture: d > today,
    });
  }

  // Bucket minutes into 5 intensity levels — 0, light, medium, strong, max.
  function intensity(m) {
    if (m === 0)  return 0;
    if (m <= 30)  return 1;
    if (m <= 60)  return 2;
    if (m <= 120) return 3;
    return 4;
  }
  const LEVEL_COLORS = [
    "rgba(255,255,255,0.06)",     // 0 — very faint
    "rgba(248,182,166,0.30)",     // 1 — light peach
    "rgba(248,182,166,0.55)",     // 2 — mid peach
    "rgba(248,182,166,0.80)",     // 3 — strong peach
    "var(--accent)",              // 4 — full peach accent
  ];

  // Month labels — one per unique month across the top row.
  const monthLabels = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7);
    if (d.getMonth() !== lastMonth) {
      monthLabels.push({ week: w, label: d.toLocaleDateString(undefined, { month: "short" }) });
      lastMonth = d.getMonth();
    }
  }

  const W = LEFT_PAD + weeks * (CELL + GAP);
  const H = TOP_PAD + 7 * (CELL + GAP) + 22; // extra room for legend

  return (
    <div className="card-glass">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Activity · last 90d</h2>
        <span className="text-[10px] text-[var(--muted)]">minutes / day</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* Month labels along the top */}
        {monthLabels.map((m) => (
          <text key={`m-${m.week}`}
                x={LEFT_PAD + m.week * (CELL + GAP)}
                y={TOP_PAD - 4}
                fontSize="8" fill="var(--muted)">
            {m.label}
          </text>
        ))}
        {/* Weekday labels — only M, W, F to save space */}
        {[[0, "M"], [2, "W"], [4, "F"]].map(([row, label]) => (
          <text key={`d-${row}`}
                x={LEFT_PAD - 4}
                y={TOP_PAD + row * (CELL + GAP) + CELL - 2}
                textAnchor="end"
                fontSize="8" fill="var(--muted)">
            {label}
          </text>
        ))}
        {/* Cells */}
        {cells.map((c) => {
          if (c.isFuture) return null;
          const level = intensity(c.minutes);
          return (
            <rect
              key={c.dateStr}
              x={LEFT_PAD + c.week * (CELL + GAP)}
              y={TOP_PAD + c.dow * (CELL + GAP)}
              width={CELL} height={CELL}
              rx="2" ry="2"
              fill={LEVEL_COLORS[level]}
            >
              <title>{c.dateStr} — {c.minutes} min</title>
            </rect>
          );
        })}
        {/* Legend along the bottom */}
        <g transform={`translate(${LEFT_PAD}, ${TOP_PAD + 7 * (CELL + GAP) + 8})`}>
          <text x="0" y="8" fontSize="8" fill="var(--muted)">Less</text>
          {LEVEL_COLORS.map((color, i) => (
            <rect
              key={`legend-${i}`}
              x={24 + i * (CELL + 2)}
              y="0"
              width={CELL - 2} height={CELL - 2}
              rx="2" ry="2"
              fill={color}
            />
          ))}
          <text x={24 + LEVEL_COLORS.length * (CELL + 2) + 2} y="8" fontSize="8" fill="var(--muted)">More</text>
        </g>
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
