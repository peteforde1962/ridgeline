// /day/[date] — universal day view keyed by an ISO date string.
// Works for:
//   • Days inside the plan window        → shows template sessions + extras
//   • Days past the plan or before start  → shows synced activities + lets user
//                                           add "extras" via virtual week/day
//   • Users with no plan at all           → shows synced activities only,
//                                           with a CTA to set up a plan
//
// Calendar cells link here so every day is accessible for logging.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, DAY_NAMES, sessionLabel } from "@/lib/plan";
import SessionCard from "@/components/SessionCard";
import PageHeader from "@/components/PageHeader";
import DayNotesEditor from "@/components/DayNotesEditor";
import AddExtraSessionForm from "@/components/AddExtraSessionForm";
import DeleteRow from "@/components/DeleteRow";

export default async function DayPage({ params }) {
  const dateStr = params?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  const plan = buildPlan(profile);

  // Compute virtual (weekIndex, dayIndex) so extras + notes have a stable
  // storage key even for days past the plan's end. Uses same Monday anchor
  // as dateForDay() so plan-window dates map to their real w/d.
  let weekIndex = null, dayIndex = null, dayObj = null, inPlan = false;
  const canStoreExtras = !!profile?.started_at;
  if (canStoreExtras) {
    const start = new Date(profile.started_at + "T00:00:00");
    const offsetToMon = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offsetToMon);
    const day = new Date(dateStr + "T00:00:00");
    const diffDays = Math.floor((day - start) / 86400_000);
    if (diffDays >= 0) {
      weekIndex = Math.floor(diffDays / 7);
      dayIndex  = diffDays % 7;
      if (weekIndex < plan.length) {
        inPlan = true;
        dayObj = plan[weekIndex].days[dayIndex];
      }
    }
  }

  // Fetch what we need. Only hit plan_sessions/plan_day_notes if we have
  // valid indices; always hit rides by date.
  const [
    { data: storedSessions },
    { data: dayRides },
    { data: noteRow },
  ] = await Promise.all([
    (weekIndex != null && dayIndex != null)
      ? supabase.from("plan_sessions")
          .select("id,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes,ride_id,ai_workout,prescribed_by_coach_id,planned_minutes")
          .eq("user_id", user.id).eq("week_index", weekIndex).eq("day_index", dayIndex)
      : Promise.resolve({ data: [] }),
    supabase.from("rides")
      .select("id, km, elev_m, minutes, source, notes, sport_type, activity_kind, ride_trails(trails(name))")
      .eq("user_id", user.id).eq("date", dateStr)
      .order("minutes", { ascending: false }),
    (weekIndex != null && dayIndex != null)
      ? supabase.from("plan_day_notes").select("note")
          .eq("user_id", user.id).eq("week_index", weekIndex).eq("day_index", dayIndex).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Look up any rides linked from plan_sessions.
  const linkedRideIds = (storedSessions || []).map((s) => s.ride_id).filter(Boolean);
  const { data: linkedRides } = linkedRideIds.length > 0
    ? await supabase.from("rides").select("id, notes, km, minutes, elev_m").in("id", linkedRideIds)
    : { data: [] };
  const rideById = {};
  (linkedRides || []).forEach((r) => { rideById[r.id] = r; });
  const annotate = (s) => (s.ride_id ? { ...s, linkedRide: rideById[s.ride_id] } : s);

  const extras = (storedSessions || []).filter(s => s.is_extra).map(annotate).sort((a, b) => a.session_idx - b.session_idx);
  const templateState = (storedSessions || []).reduce((acc, s) => {
    if (!s.is_extra) acc[s.session_idx] = annotate(s);
    return acc;
  }, {});

  const allIdx = (storedSessions || []).map(s => s.session_idx);
  const templateCount = dayObj?.details?.length || 0;
  const nextSessionIdx = Math.max(templateCount - 1, ...(allIdx.length ? allIdx : [-1])) + 1;

  const parsedDate = new Date(dateStr + "T00:00:00");
  const displayDate = parsedDate.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // Navigation to previous / next day.
  const prev = new Date(parsedDate); prev.setDate(prev.getDate() - 1);
  const next = new Date(parsedDate); next.setDate(next.getDate() + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader back="/calendar" />

      <div className="flex items-center justify-between mb-2">
        <a href="/calendar" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Calendar</a>
      </div>

      <h1 className="text-3xl font-extrabold mb-1">{displayDate}</h1>
      <p className="text-[var(--muted)] mb-6">
        {inPlan
          ? `Week ${weekIndex + 1} · ${DAY_NAMES[dayIndex]}`
          : canStoreExtras
            ? "Outside the plan window — you can still log workouts here."
            : "No active plan yet. Set one up on Profile to unlock periodized workouts."}
      </p>

      {/* Day notes only make sense when we have somewhere to store them */}
      {(weekIndex != null && dayIndex != null) && (
        <DayNotesEditor
          userId={user.id} weekIndex={weekIndex} dayIndex={dayIndex}
          initialNote={noteRow?.note || ""}
        />
      )}

      {/* Template sessions if in plan */}
      {inPlan && dayObj && dayObj.details.length === 0 && (
        <div className="card text-center mb-3"><p>Scheduled as a rest day. You can add any workout below.</p></div>
      )}
      {inPlan && dayObj && dayObj.details.map((session, i) => (
        <SessionCard
          key={`t-${i}`}
          userId={user.id}
          weekIndex={weekIndex}
          dayIndex={dayIndex}
          sessionIdx={i}
          session={session}
          stored={templateState[i]}
        />
      ))}

      {/* Extras (user-added or coach-prescribed) */}
      {extras.map((e) => {
        const synthSession = {
          type: e.swapped_to || "ride",
          name: e.custom_name || `Extra ${sessionLabel(e.swapped_to || "ride")}`,
          notes: e.custom_notes || (e.ride_id ? "Recorded activity — click View for details" : "User-added workout"),
        };
        return (
          <div key={`e-${e.session_idx}`} className="relative">
            <SessionCard
              userId={user.id}
              weekIndex={weekIndex}
              dayIndex={dayIndex}
              sessionIdx={e.session_idx}
              session={synthSession}
              stored={e}
            />
            <div className="flex justify-end -mt-2 mb-3">
              <DeleteRow table="plan_sessions" id={e.id} label="Remove this workout" confirm={`Remove "${synthSession.name}"?`} />
            </div>
          </div>
        );
      })}

      {/* Synced activities that landed on this date */}
      {(dayRides || []).length > 0 && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mt-6 mb-2">
            Synced activities
          </h2>
          {dayRides.map((r) => (
            <div key={r.id} className="card mb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {r.notes?.split(" · ")[0] || "Activity"}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {r.minutes} min · {r.km} km · {r.elev_m || 0} m climb · from {r.source}
                  </div>
                </div>
                <a href={`/rides/${r.id}`} className="btn-ghost text-xs" style={{ padding: "5px 10px" }}>
                  View activity →
                </a>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add-workout form. Only shows when we have a place to store the row. */}
      {(weekIndex != null && dayIndex != null) && (
        <div className="mb-4 mt-4">
          <AddExtraSessionForm
            userId={user.id}
            weekIndex={weekIndex}
            dayIndex={dayIndex}
            nextSessionIdx={nextSessionIdx}
          />
        </div>
      )}

      {/* If no plan, hard nudge to set one up */}
      {!canStoreExtras && (
        <div className="card text-center mt-6" style={{ padding: 24 }}>
          <p className="text-sm text-[var(--muted)] mb-3">Set up a plan to add and track workouts on any day.</p>
          <a href="/profile" className="btn-primary text-sm">Set up a plan →</a>
        </div>
      )}

      <nav className="flex justify-between mt-6">
        <a href={`/day/${iso(prev)}`} className="btn-ghost text-sm">← Previous day</a>
        <a href={`/day/${iso(next)}`} className="btn-ghost text-sm">Next day →</a>
      </nav>
    </main>
  );
}
