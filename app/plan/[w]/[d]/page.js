// /plan/[w]/[d] — drill-in to any specific day in the plan.
// Renders the same interactive SessionCard components used in /today, so users can
// mark sessions done, change intensity, or swap, for any day of the plan.

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, DAY_NAMES, currentWeekIndex, todayDayIndex } from "@/lib/plan";
import SessionCard from "@/components/SessionCard";
import PageHeader from "@/components/PageHeader";

export default async function PlanDayPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const plan = buildPlan(profile);
  const wIdx = Number(params.w);
  const dIdx = Number(params.d);
  if (!Number.isInteger(wIdx) || !Number.isInteger(dIdx) || wIdx < 0 || wIdx >= plan.length || dIdx < 0 || dIdx > 6) {
    notFound();
  }

  const week = plan[wIdx];
  const day = week.days[dIdx];

  const { data: storedSessions } = await supabase
    .from("plan_sessions").select("*")
    .eq("user_id", user.id)
    .eq("week_index", wIdx)
    .eq("day_index", dIdx);

  const isToday = wIdx === currentWeekIndex(profile?.started_at, plan.length) && dIdx === todayDayIndex();

  // Prev / Next day navigation
  const prevW = dIdx === 0 ? wIdx - 1 : wIdx;
  const prevD = dIdx === 0 ? 6 : dIdx - 1;
  const nextW = dIdx === 6 ? wIdx + 1 : wIdx;
  const nextD = dIdx === 6 ? 0 : dIdx + 1;
  const hasPrev = prevW >= 0;
  const hasNext = nextW < plan.length;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader back="/plan" />

      <div className="flex items-center justify-between mb-2">
        <a href="/plan" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Full plan</a>
        {isToday && <span className="text-xs px-2 py-1 rounded bg-[#f26838]/15 text-[#c04018] border border-[#f26838]/50">Today</span>}
      </div>

      <h1 className="text-3xl font-extrabold mb-1">
        Week {week.week} · {DAY_NAMES[dIdx]}
      </h1>
      <p className="text-[var(--muted)] mb-6">{week.phaseName} phase</p>

      {day.details.length === 0 ? (
        <div className="card text-center">
          <p>Rest day. Hydrate, sleep, foam-roll.</p>
        </div>
      ) : (
        day.details.map((session, i) => {
          const stored = storedSessions?.find(
            (s) => s.week_index === wIdx && s.day_index === dIdx && s.session_idx === i
          );
          return (
            <SessionCard
              key={i}
              userId={user.id}
              weekIndex={wIdx}
              dayIndex={dIdx}
              sessionIdx={i}
              session={session}
              stored={stored}
            />
          );
        })
      )}

      <nav className="flex justify-between mt-6">
        {hasPrev ? (
          <a href={`/plan/${prevW}/${prevD}`} className="btn-ghost text-sm">← Previous day</a>
        ) : <span />}
        {hasNext ? (
          <a href={`/plan/${nextW}/${nextD}`} className="btn-ghost text-sm">Next day →</a>
        ) : <span />}
      </nav>
    </main>
  );
}
