// /plan — full N-week plan with calendar dates, ✓/✗ icons, phase context.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlan, currentWeekIndex, sessionLabel, sessionTagClass, PHASES,
  dateForDay, formatShortDate,
} from "@/lib/plan";
import PlanDayCell from "@/components/PlanDayCell";
import PageHeader from "@/components/PageHeader";

export default async function PlanPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const { data: allSessions } = await supabase
    .from("plan_sessions")
    .select("week_index,day_index,session_idx,completed,tweak")
    .eq("user_id", user.id);

  const sessionsByDay = {};
  for (const s of (allSessions || [])) {
    const key = `${s.week_index}-${s.day_index}`;
    sessionsByDay[key] = sessionsByDay[key] || {};
    sessionsByDay[key][s.session_idx] = s;
  }

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);

  // Compute phase allocation summary so the user can see what their plan length means.
  const phaseSummary = PHASES.map((p) => ({
    ...p,
    actual: plan.filter((w) => w.phase === p.key).length,
  })).filter((p) => p.actual > 0);

  function weekStats(weekI) {
    let scheduled = 0, done = 0;
    plan[weekI].days.forEach((d, di) => {
      d.details.forEach((s, si) => {
        if (s.type === "rest") return;
        scheduled++;
        if (sessionsByDay[`${weekI}-${di}`]?.[si]?.completed) done++;
      });
    });
    return { scheduled, done, pct: scheduled ? Math.round(100 * done / scheduled) : 0 };
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">{plan.length}-Week Plan</h1>
      <p className="text-[var(--muted)] mb-5">
        Tap a session tag to cycle: <span className="text-[var(--text)]">○ pending → ✓ done → ✗ skipped</span>.
        Click anywhere else on a day to drill into details.
      </p>

      {/* Phase breakdown — explains exactly how the weeks are allocated */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {phaseSummary.map((p) => {
          const isCurrent = plan[wIdx]?.phase === p.key;
          return (
            <div
              key={p.key}
              className={`p-3 rounded-lg text-center ${isCurrent ? "border-2" : "border"}`}
              style={{
                background: isCurrent ? "rgba(248,223,112,.12)" : "var(--panel)",
                borderColor: isCurrent ? "var(--accent)" : "var(--line)",
              }}
            >
              <div className="font-bold text-sm">{p.name}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{p.actual} wk{p.actual > 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5 text-xs">
        {["ride","strength","yoga","run","rope","rest"].map((t) => (
          <span key={t} className={`px-2 py-1 rounded ${sessionTagClass(t)}`}>
            {sessionLabel(t)}
          </span>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-4">
        {plan.map((w, i) => {
          const isCurrent = i === wIdx;
          const stats = weekStats(i);
          const weekStartDate = dateForDay(profile?.started_at, i, 0);
          const weekEndDate   = dateForDay(profile?.started_at, i, 6);
          return (
            <div
              key={w.week}
              className="card"
              style={{
                borderColor: isCurrent ? "var(--accent)" : "var(--line)",
                borderWidth: isCurrent ? 2 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div>
                  <div className="font-bold">
                    Week {w.week} of {plan.length}
                    <span className="text-[var(--muted)] font-normal"> — {w.phaseName} ({w.phaseWeek}/{w.phaseTotalWeeks})</span>
                  </div>
                  {weekStartDate && (
                    <div className="text-xs text-[var(--muted)]">
                      {formatShortDate(weekStartDate)} – {formatShortDate(weekEndDate)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted)]">{stats.done}/{stats.scheduled} done</span>
                  {isCurrent && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-[#f8df70]/20 text-[#f8df70] border border-[#f8df70]/60">
                      Current
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--bg2)" }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${stats.pct}%`,
                    background: stats.pct >= 100
                      ? "linear-gradient(90deg, var(--green), #95b890)"
                      : "linear-gradient(90deg, var(--accent), var(--accent2,#d35a40))",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {w.days.map((d, di) => (
                  <PlanDayCell
                    key={di}
                    userId={user.id}
                    weekIndex={i}
                    dayIndex={di}
                    day={d}
                    storedMap={sessionsByDay[`${i}-${di}`]}
                    dateLabel={formatShortDate(dateForDay(profile?.started_at, i, di))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
