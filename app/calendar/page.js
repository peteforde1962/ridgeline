// /calendar — month-grid view of the plan + any synced activities.
// Split out from /plan so it's easier to navigate to and stays useful when
// the plan itself is complete or not yet set up (you can still see rides).

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlan, dateForDay, todayDateInTz, planStatus,
} from "@/lib/plan";
import PlanCalendar from "@/components/PlanCalendar";
import PageHeader from "@/components/PageHeader";

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const plan   = buildPlan(profile);
  const status = planStatus(profile, plan);

  // Pull plan-side state (sessions + notes) and rides for the last 90 days
  // so calendar cells reflect both the plan and the activity you actually did.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const [{ data: allSessions }, { data: allNotes }, { data: recentRides }] = await Promise.all([
    supabase
      .from("plan_sessions")
      .select("week_index,day_index,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes,ride_id")
      .eq("user_id", user.id),
    supabase
      .from("plan_day_notes")
      .select("week_index, day_index")
      .eq("user_id", user.id),
    supabase
      .from("rides")
      .select("id, date, minutes, activity_kind")
      .eq("user_id", user.id)
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false }),
  ]);

  // Index plan session state by (week, day).
  const sessionsByDay = {};
  const extrasByDay = {};
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

  // Rides grouped by date so calendar cells can show an "activity" marker on
  // days when a ride happened — even outside the plan window.
  const ridesByDate = {};
  for (const r of (recentRides || [])) {
    ridesByDate[r.date] = ridesByDate[r.date] || [];
    ridesByDate[r.date].push(r);
  }

  const todayYMD = todayDateInTz(profile?.timezone);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-3xl font-extrabold">Calendar</h1>
        {status === "active" && (
          <a href="/plan" className="text-sm text-[var(--accent)] font-semibold">
            Week view →
          </a>
        )}
      </div>
      <p className="text-[var(--muted)] mb-4">
        {status === "active"
          ? "Month view of your plan + synced activities. Click a day to open it."
          : status === "complete"
          ? "Your plan is complete — this view still shows any activity you've synced."
          : "No plan set up yet — this shows any activity you've synced. Set up a plan on Profile to fill the grid."}
      </p>

      <PlanCalendar
        plan={plan}
        startedAt={profile?.started_at}
        sessionsByDay={sessionsByDay}
        extrasByDay={extrasByDay}
        notesByDay={notesByDay}
        ridesByDate={ridesByDate}
        todayYMD={todayYMD}
      />
    </main>
  );
}
