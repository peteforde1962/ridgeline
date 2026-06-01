// /coaching/students/[id]/plan/[w]/[d] — one day in a student's plan, coach view.
// Coach can: add a new prescribed workout for this date, edit existing prescribed
// workouts, delete prescribed workouts.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, sessionLabel, sessionTagClass, dateForDay } from "@/lib/plan";
import PageHeader from "@/components/PageHeader";
import CoachDaySessions from "@/components/CoachDaySessions";

export default async function CoachPlanDay({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, coach_approved").eq("id", user.id).single();
  if (me?.role !== "coach" || !me?.coach_approved) redirect("/profile");

  const { data: student } = await supabase
    .from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!student) notFound();

  const weekIndex = parseInt(params.w, 10);
  const dayIndex  = parseInt(params.d, 10);
  const plan = buildPlan(student);
  const week = plan[weekIndex];
  if (!week) notFound();
  const day = week.days[dayIndex];

  const { data: storedSessions } = await supabase
    .from("plan_sessions")
    .select("*")
    .eq("user_id", student.id)
    .eq("week_index", weekIndex)
    .eq("day_index", dayIndex);

  const studentName = student.name || student.email.split("@")[0];
  const dateStr = dateForDay(student.started_at, weekIndex, dayIndex);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <a href={`/coaching/students/${student.id}/plan`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← Back to plan
      </a>

      <h1 className="text-3xl font-extrabold mt-2 mb-1">
        Week {week.week} · {day.day}
      </h1>
      <p className="text-[var(--muted)] mb-6">
        {studentName} · {dateStr} · {week.phaseName} phase
      </p>

      <CoachDaySessions
        studentId={student.id}
        studentName={studentName}
        date={dateStr}
        templateDay={day}
        storedSessions={storedSessions || []}
        coachId={user.id}
      />
    </main>
  );
}
