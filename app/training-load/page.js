// /training-load — full TrainingPeaks-style fitness/fatigue/form view.
// Day-by-day TSS bars, 90-day chart with 14-day projection, ride list with per-ride TSS.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  tssForRide, trainingLoadSeries, currentLoad,
  formInterpretation, projectForward, methodLabel,
} from "@/lib/training-load";
import PageHeader from "@/components/PageHeader";

export default async function TrainingLoadPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const { data: allRides } = await supabase
    .from("rides")
    .select("id, date, km, elev_m, minutes, notes, avg_hr, avg_watts, weighted_avg_watts, suffer_score")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const series = trainingLoadSeries(allRides || [], 90, profile);
  const future = projectForward(series, 14);
  const fullSeries = [...series, ...future];
  const load = currentLoad(series);
  const form = formInterpretation(load.form);

  // Last 30 days of rides with per-ride TSS for the table.
  const thirty = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const recentRides = (allRides || [])
    .filter((r) => r.date >= thirty)
    .map((r) => ({ ...r, ...tssForRide(r, profile) }))
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  // Weekly TSS totals — group last 12 weeks.
  const weeklyTotals = {};
  for (const s of series) {
    const d = new Date(s.date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = monday.toISOString().slice(0, 10);
    weeklyTotals[wk] = (weeklyTotals[wk] || 0) + s.tss;
  }
  const weeks = Object.keys(weeklyTotals).sort().slice(-12);

  // Source / method mix over the 90 days.
  const methodCounts = { power: 0, hr: 0, strava: 0, tier: 0 };
  for (const s of series) if (s.method) methodCounts[s.method]++;
  const totalMethodDays = Object.values(methodCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Training load</h1>
      <p className="text-[var(--muted)] mb-6">
        Fitness, fatigue, and form. The chart projects 14 days forward assuming zero training.
      </p>

      {/* --- Current values + form interpretation --- */}
      <section className="card-glass mb-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Now</h2>
          <span className="text-xs px-2 py-0.5 rounded"
                style={{ background: `${form.color}22`, color: form.color, border: `1px solid ${form.color}66` }}>
            {form.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <BigStat label="Fitness (CTL)"  v={load.fitness} sub="42-day exponential avg of daily TSS" color="#5fa7c4" />
          <BigStat label="Fatigue (ATL)"  v={load.fatigue} sub="7-day exponential avg of daily TSS"  color="#f0ad4e" />
          <BigStat label="Form (TSB)"     v={load.form}    sub="CTL − ATL"                            color={form.color} />
        </div>
      </section>

      {/* --- 90-day chart with projection --- */}
      <section className="card-glass mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">90 days + 14-day projection</h2>
        <BigChart series={fullSeries} pivotDate={series[series.length - 1]?.date} />
        <div className="flex gap-4 text-xs text-[var(--muted)] mt-3 flex-wrap">
          <LegendDot color="#5fa7c4" label="Fitness (CTL)" />
          <LegendDot color="#f0ad4e" label="Fatigue (ATL)" dashed />
          <LegendDot color="var(--accent)" label="Form (TSB)" />
          <span>—— dashed vertical = today</span>
        </div>
      </section>

      {/* --- Daily TSS bars (last 30 days) --- */}
      <section className="card-glass mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Daily TSS · last 30 days</h2>
        <DailyTSSBars series={series.slice(-30)} />
      </section>

      {/* --- Weekly TSS totals (last 12 weeks) --- */}
      <section className="card-glass mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">Weekly TSS · last 12 weeks</h2>
        <WeeklyTSS weeks={weeks} totals={weeklyTotals} />
      </section>

      {/* --- TSS source mix --- */}
      <section className="card-glass mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3">TSS data sources</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Which intensity signal each ride used. Better signals → more accurate TSS. Set FTP / LTHR in
          <a href="/profile" className="text-[var(--accent)] font-semibold ml-1">your profile</a> to unlock power/HR-based TSS.
        </p>
        <div className="grid grid-cols-4 gap-3">
          <MethodChip method="power"  count={methodCounts.power}  pct={Math.round(100*methodCounts.power/totalMethodDays)}  />
          <MethodChip method="hr"     count={methodCounts.hr}     pct={Math.round(100*methodCounts.hr/totalMethodDays)}     />
          <MethodChip method="strava" count={methodCounts.strava} pct={Math.round(100*methodCounts.strava/totalMethodDays)} />
          <MethodChip method="tier"   count={methodCounts.tier}   pct={Math.round(100*methodCounts.tier/totalMethodDays)}   />
        </div>
      </section>

      {/* --- Recent rides with per-ride TSS --- */}
      <section className="card mb-4 p-0 overflow-hidden">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-3 p-4 pb-0">Rides · last 30 days</h2>
        {recentRides.length === 0 ? (
          <p className="text-sm text-[var(--muted)] p-4">No rides in the last 30 days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] text-xs uppercase tracking-wide">
                <th className="p-3">Date</th>
                <th>Ride</th>
                <th>Duration</th>
                <th>HR / W</th>
                <th>Method</th>
                <th className="pr-3 text-right">TSS</th>
              </tr>
            </thead>
            <tbody>
              {recentRides.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)]">
                  <td className="p-3">{r.date.slice(5)}</td>
                  <td><a href={`/rides/${r.id}`} className="text-[var(--accent)]">{(r.notes || "Ride").split(" · ")[0]}</a></td>
                  <td>{r.minutes} min</td>
                  <td className="text-[var(--muted)] text-xs">
                    {r.avg_hr ? `${r.avg_hr}bpm` : "—"}
                    {r.weighted_avg_watts ? ` · ${r.weighted_avg_watts}W NP` : (r.avg_watts ? ` · ${r.avg_watts}W` : "")}
                  </td>
                  <td className="text-xs text-[var(--muted)]">{methodLabel(r.method)}</td>
                  <td className="pr-3 text-right font-bold">{r.tss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <details className="card mb-4 text-sm">
        <summary className="cursor-pointer font-bold">What do these numbers mean?</summary>
        <div className="mt-3 space-y-2 text-[var(--muted)]">
          <p><strong className="text-[var(--text)]">TSS</strong> — Training Stress Score. 100 ≈ one hour at threshold. A 2-hour endurance ride is ~80–120 TSS; a 4-hour epic with climbing is ~250+.</p>
          <p><strong className="text-[var(--text)]">CTL (Fitness)</strong> — exponentially-weighted 42-day average of TSS. Rises slowly with consistent training; the bigger it gets, the more work you can absorb.</p>
          <p><strong className="text-[var(--text)]">ATL (Fatigue)</strong> — same calc but on a 7-day window. Reacts quickly to recent work.</p>
          <p><strong className="text-[var(--text)]">TSB (Form)</strong> — CTL − ATL. Positive means you're fresher than your average load; negative means you're carrying more recent fatigue than fitness. Racers want TSB +5 to +15 on race day.</p>
          <p><strong className="text-[var(--text)]">Method priority</strong> — Power (TSS formula) is most accurate, then HR (hrTSS via avg_hr ÷ LTHR), then Strava's Relative Effort (when no HR was recorded), finally a duration-based fallback.</p>
        </div>
      </details>
    </main>
  );
}

// ============================================================
// Components
// ============================================================

function BigStat({ label, v, sub, color }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-4xl font-extrabold" style={{ color }}>{v.toFixed(1)}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>
    </div>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span style={{
        display: "inline-block", width: 14, height: 0,
        borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
      }} />
      {label}
    </span>
  );
}

function BigChart({ series, pivotDate }) {
  const W = 900, H = 240, padX = 36, padY = 14, padBottom = 22;
  if (!series || series.length === 0) {
    return <div className="text-sm text-[var(--muted)] py-4 text-center">No ride data yet.</div>;
  }
  const allVals = [...series.map(s => s.ctl), ...series.map(s => s.atl), ...series.map(s => s.tsb)];
  const yMin = Math.min(0, Math.floor(Math.min(...allVals) - 5));
  const yMax = Math.max(20, Math.ceil(Math.max(...allVals) + 5));
  const x = (i) => padX + (i / (series.length - 1)) * (W - padX - 6);
  const y = (v) => padY + ((yMax - v) / (yMax - yMin)) * (H - padY - padBottom);
  const pivotIdx = series.findIndex(s => s.date === pivotDate);

  function path(key) {
    return series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[key])}`).join(" ");
  }
  function pathProjected(key) {
    // Same data, but render only the projected segment as dashed.
    if (pivotIdx < 0) return "";
    return series.slice(pivotIdx).map((s, j) => `${j === 0 ? "M" : "L"}${x(pivotIdx + j)},${y(s[key])}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* freshness zones */}
      {yMin < 0 && yMax > 0 && (
        <>
          <rect x={padX} y={y(yMax)} width={W - padX - 6} height={y(0) - y(yMax)} fill="#5cb85c" opacity="0.05" />
          <rect x={padX} y={y(0)}    width={W - padX - 6} height={y(yMin) - y(0)} fill="#d9534f" opacity="0.05" />
          <line x1={padX} y1={y(0)} x2={W - 6} y2={y(0)} stroke="var(--line)" strokeDasharray="3,3" />
        </>
      )}
      {/* y ticks */}
      {[yMax, Math.round((yMax + yMin) / 2), yMin].map((t, i) => (
        <g key={i}>
          <text x={padX - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
        </g>
      ))}
      {/* full lines (history) */}
      <path d={path("ctl")} fill="none" stroke="#5fa7c4" strokeWidth="2" />
      <path d={path("atl")} fill="none" stroke="#f0ad4e" strokeWidth="2" strokeDasharray="4,2" />
      <path d={path("tsb")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {/* overlay projected portion in lighter opacity */}
      {pivotIdx > 0 && (
        <>
          <path d={pathProjected("ctl")} fill="none" stroke="#5fa7c4" strokeWidth="2" opacity="0.5" strokeDasharray="2,3" />
          <path d={pathProjected("atl")} fill="none" stroke="#f0ad4e" strokeWidth="2" opacity="0.5" strokeDasharray="2,3" />
          <path d={pathProjected("tsb")} fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity="0.5" strokeDasharray="2,3" />
          <line x1={x(pivotIdx)} y1={padY} x2={x(pivotIdx)} y2={H - padBottom}
                stroke="var(--muted)" strokeWidth="0.8" strokeDasharray="2,3" />
          <text x={x(pivotIdx) + 4} y={padY + 10} fontSize="9" fill="var(--muted)">today</text>
        </>
      )}
      {/* date labels */}
      <text x={padX} y={H - 6} textAnchor="start" fontSize="10" fill="var(--muted)">
        {new Date(series[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </text>
      <text x={W - 6} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">
        {new Date(series[series.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </text>
    </svg>
  );
}

function DailyTSSBars({ series }) {
  const W = 900, H = 140, padX = 30, padY = 10, padBottom = 24;
  if (!series.length) return null;
  const maxTss = Math.max(50, ...series.map(s => s.tss));
  const barW = (W - padX - 6) / series.length - 2;
  const x = (i) => padX + (i / series.length) * (W - padX - 6) + (W - padX - 6) / (series.length * 2);
  const y = (v) => padY + (1 - v / maxTss) * (H - padY - padBottom);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* y ticks */}
      {[maxTss, Math.round(maxTss / 2)].map((t, i) => (
        <g key={i}>
          <line x1={padX} y1={y(t)} x2={W - 6} y2={y(t)} stroke="var(--line)" strokeDasharray="2,3" />
          <text x={padX - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{t}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const bh = s.tss > 0 ? (H - padY - padBottom) * (s.tss / maxTss) : 0;
        const showLabel = i % 5 === 0 || i === series.length - 1;
        return (
          <g key={s.date}>
            {s.tss > 0 ? (
              <>
                <rect x={x(i) - barW / 2} y={y(s.tss)} width={barW} height={Math.max(2, bh)}
                      rx="2" fill="var(--accent)">
                  <title>{`${s.date}: ${s.tss} TSS`}</title>
                </rect>
              </>
            ) : (
              <circle cx={x(i)} cy={H - padBottom - 2} r="1.5" fill="var(--line)" />
            )}
            {showLabel && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">
                {new Date(s.date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function WeeklyTSS({ weeks, totals }) {
  const maxTss = Math.max(100, ...weeks.map((w) => totals[w]));
  return (
    <ol className="space-y-2">
      {weeks.map((wk) => {
        const t = totals[wk] || 0;
        const pct = Math.max(2, (t / maxTss) * 100);
        return (
          <li key={wk}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted)]">
                Week of {new Date(wk).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <span className="font-semibold">{t} TSS</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "var(--bg2)" }}>
              <div className="h-full rounded-full"
                   style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2,#fccabb))" }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const METHOD_DETAILS = {
  power:  { label: "Power + FTP",          color: "#5fa7c4" },
  hr:     { label: "HR + LTHR",            color: "#9c6cd9" },
  strava: { label: "Strava Relative Effort", color: "#f56e6e" },
  tier:   { label: "Duration estimate",    color: "var(--muted)" },
};

function MethodChip({ method, count, pct }) {
  const d = METHOD_DETAILS[method];
  return (
    <div className="rounded p-3" style={{ background: "var(--bg2)" }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: d.color }}>{d.label}</div>
      <div className="text-2xl font-extrabold">{count}</div>
      <div className="text-xs text-[var(--muted)]">{pct}% of days</div>
    </div>
  );
}
