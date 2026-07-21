// /today — what's on the docket today?

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex, todayDateInTz, readinessFromCheckin, sessionLabel, planStatus } from "@/lib/plan";
import { recordedActivityLabel } from "@/lib/activity-mapping";
import SessionCard from "@/components/SessionCard";
import LogoMark from "@/components/LogoMark";
import Icon from "@/lib/icons";

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
  const status = planStatus(profile, plan);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex(profile?.timezone);
  // When status is "complete" or "none", these clamp to safe indices but we
  // won't render plan sessions from them below.
  const week = plan[wIdx];
  const day  = week?.days?.[dIdx];

  // Pull persisted state for today's sessions (including ride_id + ai_workout).
  const { data: storedSessions } = await supabase
    .from("plan_sessions")
    .select("id,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes,ride_id,ai_workout,prescribed_by_coach_id,planned_minutes")
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
          <LogoMark size={28} />
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <h1 className="text-3xl font-extrabold mb-1">Today</h1>
      <p className="text-[var(--muted)] mb-5">
        {status === "active" ? (
          <>Week {week.week} · {day.day} · {week.phaseName} phase</>
        ) : status === "complete" ? (
          <>Plan complete — free training. <a href="/profile" className="text-[var(--accent)] font-semibold">Start a new plan →</a></>
        ) : (
          <>No active plan. <a href="/profile" className="text-[var(--accent)] font-semibold">Set one up →</a></>
        )}
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

      {/* Template plan sessions — only render when the plan is actively running.
          On "complete" or "none", these are meaningless so we skip them. */}
      {status === "active" && (
        day.details.length === 0 ? (
          <div className="card text-center mb-3">
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
        )
      )}

      {/* User-added extras + auto-imported "Recorded X" markers — always shown. */}
      {status === "active" && (annotatedSessions || []).filter((s) => s.is_extra).map((e) => {
        const synthSession = {
          type:  e.swapped_to || "ride",
          name:  e.custom_name || `Extra ${sessionLabel(e.swapped_to || "ride")}`,
          notes: e.custom_notes || (e.ride_id ? "Recorded activity — click View for details" : "User-added workout"),
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

      {/* Today's synced activities. Two rules:
          - In "complete" / "none" state: show every ride we imported today so
            the user still sees their activity.
          - In "active" state: only show rides that AREN'T already linked to a
            plan session (safety net for when sync hasn't auto-ticked yet). */}
      {(() => {
        const linkedIds = new Set(
          (annotatedSessions || []).map((s) => s.ride_id).filter(Boolean)
        );
        const ridesToShow = (dayRides || []).filter(
          (r) => status !== "active" || !linkedIds.has(r.id)
        );
        if (ridesToShow.length === 0) return null;
        return (
          <>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mt-4 mb-2">
              Today's activities
            </h2>
            {ridesToShow.map((r) => (
              <div key={r.id} className="card mb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {r.notes?.split(" · ")[0] || recordedActivityLabel("cycle")}
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      {r.minutes} min · {r.km} km · {r.elev_m || 0} m climb · from {r.source}
                    </div>
                  </div>
                  <a href={`/rides/${r.id}`} className="btn-ghost text-xs"
                     style={{ padding: "5px 10px" }}>
                    View activity →
                  </a>
                </div>
              </div>
            ))}
          </>
        );
      })()}

      {/* No plan + no activity today — soft nudge to check in or start a plan. */}
      {status === "none" && (dayRides || []).length === 0 && (
        <div className="card text-center mt-4" style={{ padding: 28 }}>
          <p className="mb-3">No workouts scheduled and no activity synced today.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <a href="/profile" className="btn-primary text-sm">Set up a plan →</a>
            <a href="/coach" className="btn-ghost text-sm inline-flex items-center gap-1">
              <Icon name="bolt" size={13} /> Ask Coach AI
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
