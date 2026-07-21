// /plan — full N-week plan grid with swap-aware tags, extras, and note indicators.
// Calendar (month-grid) view now lives at its own route: /calendar.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlan, currentWeekIndex, sessionLabel, sessionTagClass, PHASES,
  dateForDay, formatShortDate, planStatus,
} from "@/lib/plan";
import PlanDayCell from "@/components/PlanDayCell";
import PageHeader from "@/components/PageHeader";
import BackfillPlanButton from "@/components/BackfillPlanButton";

export default async function PlanPage({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Phase filter — clicking a phase tile narrows the weeks shown.
  const phaseFilter = typeof searchParams?.phase === "string" ? searchParams.phase : null;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  // Compute plan lifecycle status early so we can render the right shell.
  const _plan = buildPlan(profile);
  const status = planStatus(profile, _plan);

  // No active plan yet — show the setup CTA.
  if (status === "none") {
    return (
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <PageHeader />
        <h1 className="text-3xl font-extrabold mb-1">Training plan</h1>
        <p className="text-[var(--muted)] mb-6">
          You don't have an active plan yet.
        </p>
        <div className="card text-center" style={{ padding: 32 }}>
          <h2 className="text-xl font-bold mb-2">No active plan</h2>
          <p className="text-[var(--muted)] mb-5">
            Set up your training plan to get a periodized schedule built around your goals, weekly hours, and race date.
          </p>
          <a href="/profile" className="btn-primary inline-flex">Set up plan →</a>
        </div>
      </main>
    );
  }

  // Plan finished — show a completion card + next-plan CTA rather than
  // silently keeping the last week visible past its end date.
  if (status === "complete") {
    return (
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <PageHeader />
        <h1 className="text-3xl font-extrabold mb-1">Training plan</h1>
        <p className="text-[var(--muted)] mb-6">
          Your {_plan.length}-week plan is complete. Nice work.
        </p>
        <div className="card text-center" style={{ padding: 32 }}>
          <h2 className="text-xl font-bold mb-2">Plan complete 🏁</h2>
          <p className="text-[var(--muted)] mb-5">
            You wrapped the last week. Reset and generate a fresh plan around your next goal, or take a recovery block and start again when you're ready.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <a href="/profile" className="btn-primary">Start a new plan →</a>
            <a href="/calendar" className="btn-ghost">View calendar</a>
          </div>
        </div>
      </main>
    );
  }

  const [{ data: allSessions }, { data: allNotes }] = await Promise.all([
    supabase
      .from("plan_sessions")
      .select("week_index,day_index,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes")
      .eq("user_id", user.id),
    supabase
      .from("plan_day_notes")
      .select("week_index, day_index")
      .eq("user_id", user.id),
  ]);

  // Index template-session state by (week, day, session_idx) for the template
  // sessions; index extras separately as arrays so each day knows its add-ons.
  const sessionsByDay = {}; // "w-d" -> { sessionIdx: row } (template)
  const extrasByDay = {};   // "w-d" -> [row, row]          (extras)
  for (const s of (allSessions || [])) {
    const key = `${s.week_index}-${s.day_index}`;
    if (s.is_extra) {
      extrasByDay[key] = extrasByDay[key] || [];
      extrasByDay[key].push(s);
    } else {
      sessionsByDay[key] = sessionsByDay[key] || {};
      sessionsByDay[key][s.session_idx] = s;
    }
  }
  const notesByDay = new Set((allNotes || []).map((n) => `${n.week_index}-${n.day_index}`));

  // Reuse the plan we built for status detection above.
  const plan = _plan;
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);

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
      // count extras too
      (extrasByDay[`${weekI}-${di}`] || []).forEach((e) => {
        scheduled++;
        if (e.completed) done++;
      });
    });
    return { scheduled, done, pct: scheduled ? Math.round(100 * done / scheduled) : 0 };
  }


  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-3xl font-extrabold">{plan.length}-Week Plan</h1>
        <a href="/calendar" className="text-sm text-[var(--accent)] font-semibold">
          Calendar view →
        </a>
      </div>
      <p className="text-[var(--muted)] mb-3">
        Tap a session tag to cycle: <span className="text-[var(--text)]">○ pending → ✓ done → ✗ skipped</span>. Click a day to add workouts, notes, or change details. ✎ = day has notes.
      </p>

      <div className="mb-5">
        <BackfillPlanButton />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {phaseSummary.map((p) => {
          const isCurrent  = plan[wIdx]?.phase === p.key;
          const isSelected = phaseFilter === p.key;
          // Toggle: click again to clear the filter.
          const targetHref = isSelected ? `/plan` : `/plan?phase=${p.key}`;
          return (
            <a
              key={p.key}
              href={targetHref}
              className="p-3 rounded-lg text-center transition-transform hover:scale-[1.02]"
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                background: isSelected
                  ? "linear-gradient(135deg, var(--accent), var(--accent2,#fccabb))"
                  : isCurrent
                    ? "rgba(242,104,56,.12)"
                    : "var(--panel)",
                border: isSelected
                  ? "2px solid var(--accent)"
                  : isCurrent
                    ? "2px solid var(--accent)"
                    : "1px solid var(--line)",
                boxShadow: isSelected ? "0 6px 18px rgba(248,182,166,.25)" : undefined,
              }}
            >
              <div className="font-bold text-sm"
                   style={{ color: isSelected ? "#1a2a30" : undefined }}>
                {p.name}
              </div>
              <div className="text-xs mt-1"
                   style={{ color: isSelected ? "rgba(26,42,48,.7)" : "var(--muted)" }}>
                {p.actual} wk{p.actual > 1 ? "s" : ""}
              </div>
            </a>
          );
        })}
      </div>
      {phaseFilter && (
        <p className="text-xs text-[var(--muted)] mb-4">
          Filtered to <strong className="text-[var(--text)]">{phaseSummary.find(p => p.key === phaseFilter)?.name || phaseFilter}</strong> phase.
          {" "}<a href="/plan" className="text-[var(--accent)] font-semibold">Clear filter</a>
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-5 text-xs">
        {["ride","strength","yoga","run","rope","rest"].map((t) => (
          <span key={t} className={`px-2 py-1 rounded ${sessionTagClass(t)}`}>
            {sessionLabel(t)}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {plan.map((w, i) => {
          // Skip weeks not in the selected phase when a filter is active.
          if (phaseFilter && w.phase !== phaseFilter) return null;
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
                    <span className="text-xs font-bold px-2 py-1 rounded bg-[#f26838]/15 text-[#c04018] border border-[#f26838]/50">
                      Current
                    </span>
                  )}
                </div>
              </div>

              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--bg2)" }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${stats.pct}%`,
                    background: stats.pct >= 100
                      ? "linear-gradient(90deg, var(--green), #95b890)"
                      : "linear-gradient(90deg, var(--accent), var(--accent2,#ff8050))",
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
                    extras={extrasByDay[`${i}-${di}`] || []}
                    hasNote={notesByDay.has(`${i}-${di}`)}
                    dateLabel={formatShortDate(dateForDay(profile?.started_at, i, di))}
                    startedAt={profile?.started_at}
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
