// /today — what's on the docket today?

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex, readinessFromCheckin } from "@/lib/plan";
import SessionCard from "@/components/SessionCard";

export default async function TodayPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayCheckin } = await supabase
    .from("check_ins").select("*")
    .eq("user_id", user.id).eq("date", today).maybeSingle();

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex();
  const week = plan[wIdx];
  const day = week.days[dIdx];

  // Pull persisted state for today's sessions.
  const { data: storedSessions } = await supabase
    .from("plan_sessions").select("*")
    .eq("user_id", user.id)
    .eq("week_index", wIdx)
    .eq("day_index", dIdx);

  const readiness = readinessFromCheckin(todayCheckin);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
        <div className="flex items-center gap-2">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <h1 className="text-3xl font-extrabold mb-1">Today</h1>
      <p className="text-[var(--muted)] mb-5">
        Week {week.week} · {day.day} · {week.phaseName} phase
      </p>

      {readiness ? (
        <div
          className="card mb-5 text-sm"
          style={{
            borderColor:
              readiness.level === "high" ? "rgba(106,138,109,.6)"
              : readiness.level === "low" ? "rgba(215,106,74,.6)"
              : "rgba(242,104,56,.5)",
          }}
        >
          <strong>Check-in: </strong>
          <span className="text-[var(--muted)]">
            sleep {todayCheckin.sleep} · soreness {todayCheckin.soreness} · energy {todayCheckin.energy}
          </span>
          <div className="mt-1 font-semibold">→ {readiness.label}</div>
        </div>
      ) : (
        <div className="card mb-5 text-sm">
          <span className="text-[var(--muted)]">No check-in today. </span>
          <a href="/checkin" className="text-[var(--accent2,#f4b860)] font-semibold">Log one to auto-tune intensity →</a>
        </div>
      )}

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
    </main>
  );
}
