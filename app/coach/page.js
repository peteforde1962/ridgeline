// /coach — AI coaching chat with streaming + rich context.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex } from "@/lib/plan";
import CoachChat from "@/components/CoachChat";
import PageHeader from "@/components/PageHeader";

export default async function CoachPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: rides }, { data: planSessions }, { data: checkins }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("rides").select("id").eq("user_id", user.id).limit(1),
    supabase.from("plan_sessions").select("week_index, completed").eq("user_id", user.id),
    supabase.from("check_ins").select("date").eq("user_id", user.id).order("date", { ascending: false }).limit(1),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);
  const dIdx = todayDayIndex();
  const todayDay = plan[wIdx]?.days?.[dIdx];

  // Compute small bits of context the client component uses to pick starter prompts.
  const thisWeekDone = (planSessions || []).filter(s => s.week_index === wIdx && s.completed).length;
  const thisWeekSched = (todayDay ? plan[wIdx].days.reduce((a, d) => a + d.details.filter(s => s.type !== "rest").length, 0) : 0);
  const isLateInWeek = dIdx >= 4;

  let raceWithinWeeks = null;
  if (profile?.race_date) {
    const days = Math.ceil((new Date(profile.race_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days > 0) raceWithinWeeks = Math.ceil(days / 7);
  }

  const context = {
    name: profile?.name,
    hasCheckinToday: (checkins || []).some(c => c.date === today),
    todayIsRest: todayDay ? todayDay.details.length === 0 : false,
    raceWithinWeeks,
    hasNoRides: (rides || []).length === 0,
    behindThisWeek: isLateInWeek && thisWeekSched > 0 && thisWeekDone / thisWeekSched < 0.4,
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Coach AI</h1>
      <p className="text-[var(--muted)] mb-6">
        Coach sees your profile, recent check-ins, rides, current plan phase, and today's prescribed workout.
      </p>
      <CoachChat context={context} />
    </main>
  );
}
