// /today — what's on the docket today?

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex, todayDateInTz, readinessFromCheckin, sessionLabel } from "@/lib/plan";
import SessionCard from "@/components/SessionCard";

export default async function TodayPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const today = todayDateInTz(profile?.timezone);
  const [{ data: todayCheckin }, { data: dayRides }] = await Promise.all([
    supabase.from("check_ins").select("*")
      .eq("user_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("rides")
      .select("id, km, elev_m, minutes, source, notes, ride_trails(trails(name))")
      .eq("user_id", user.id).eq("date", today)
      .order("minutes", { ascending: false }),
  ]);

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex(profile?.timezone);
  const week = plan[wIdx];
  const day = week.days[dIdx];

  // Pull persisted state for today's sessions (including ride_id + ai_workout).
  const { data: storedSessions } = await supabase
    .from("plan_sessions")
    .select("id,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes,ride_id,ai_workout,prescribed_by_coach_id")
    .eq("user_id", user.id)
    .eq("week_index", wIdx)
    .eq("day_index", dIdx);

  // Fetch linked rides so SessionCard can show the Strava title.
  const linkedRideIds = (storedSessions || []).map((s) => s.ride_id).filter(Boolean);
  const { data: linkedRides } = linkedRideIds.length > 0
    ? await supabase.from("rides").select("id, notes, km, minutes, elev_m").in("id", linkedRideIds)
    : { data: [] };
  const rideById = {};
  (linkedRides || []).forEach((r) => { rideById[r.id] = r; });
  const annotatedSessions = (storedSessions || []).map((s) =>
    s.ride_id ? { ...s, linkedRide: rideById[s.ride_id] } : s
  );

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
          const stored = (annotatedSessions || []).find(
            (s) => !s.is_extra && s.session_idx === i
          );
          return (
            <SessionCard
              key={`t-${i}`}
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

      {/* User-added extras + auto-imported "Recorded ride" markers */}
      {(annotatedSessions || []).filter((s) => s.is_extra).map((e) => {
        const synthSession = {
          type:  e.swapped_to || "ride",
          name:  e.custom_name || `Extra ${sessionLabel(e.swapped_to || "ride")}`,
          notes: e.custom_notes || (e.ride_id ? "Recorded ride — click View ride for details" : "User-added workout"),
        };
        return (
          <SessionCard
            key={`e-${e.session_idx}`}
            userId={user.id}
            weekIndex={wIdx}
            dayIndex={dIdx}
            sessionIdx={e.session_idx}
            session={synthSession}
            stored={e}
          />
        );
      })}
    </main>
  );
}
