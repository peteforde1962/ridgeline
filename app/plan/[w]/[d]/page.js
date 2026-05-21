// /plan/[w]/[d] — full day editor: template sessions, extras, day notes.

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, DAY_NAMES, currentWeekIndex, todayDayIndex, sessionLabel } from "@/lib/plan";
import SessionCard from "@/components/SessionCard";
import PageHeader from "@/components/PageHeader";
import DayNotesEditor from "@/components/DayNotesEditor";
import AddExtraSessionForm from "@/components/AddExtraSessionForm";
import DeleteRow from "@/components/DeleteRow";

export default async function PlanDayPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const plan = buildPlan(profile);
  const wIdx = Number(params.w);
  const dIdx = Number(params.d);
  if (!Number.isInteger(wIdx) || !Number.isInteger(dIdx) || wIdx < 0 || wIdx >= plan.length || dIdx < 0 || dIdx > 6) {
    notFound();
  }

  const week = plan[wIdx];
  const day = week.days[dIdx];

  // Compute the actual calendar date for this plan cell.
  const { dateForDay } = await import("@/lib/plan");
  const calendarDate = dateForDay(profile?.started_at, wIdx, dIdx);

  const [{ data: storedSessions }, { data: noteRow }, { data: dayRides }] = await Promise.all([
    supabase.from("plan_sessions")
      .select("id,session_idx,completed,tweak,swapped_to,is_extra,custom_name,custom_notes,ride_id,ai_workout")
      .eq("user_id", user.id).eq("week_index", wIdx).eq("day_index", dIdx),
    supabase.from("plan_day_notes")
      .select("note").eq("user_id", user.id).eq("week_index", wIdx).eq("day_index", dIdx).maybeSingle(),
    calendarDate
      ? supabase.from("rides")
          .select("id, km, elev_m, minutes, source, notes, ride_trails(trails(name))")
          .eq("user_id", user.id).eq("date", calendarDate)
          .order("minutes", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const extras = (storedSessions || []).filter(s => s.is_extra).sort((a, b) => a.session_idx - b.session_idx);
  const templateState = (storedSessions || []).reduce((acc, s) => {
    if (!s.is_extra) acc[s.session_idx] = s;
    return acc;
  }, {});

  // Next session_idx for new extras = max + 1, with template count as floor.
  const allIdx = (storedSessions || []).map(s => s.session_idx);
  const nextSessionIdx = Math.max(day.details.length - 1, ...(allIdx.length ? allIdx : [-1])) + 1;

  const isToday = wIdx === currentWeekIndex(profile?.started_at, plan.length) && dIdx === todayDayIndex();

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

      {/* Day notes */}
      <DayNotesEditor
        userId={user.id} weekIndex={wIdx} dayIndex={dIdx}
        initialNote={noteRow?.note || ""}
      />

      {/* Template sessions */}
      {day.details.length === 0 ? (
        <div className="card text-center mb-3">
          <p>Scheduled as a rest day. You can add any workout below.</p>
        </div>
      ) : (
        day.details.map((session, i) => {
          const stored = templateState[i];
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

      {/* Extras */}
      {extras.map((e) => {
        const synthSession = {
          type: e.swapped_to || "ride",
          name: e.custom_name || `Extra ${sessionLabel(e.swapped_to || "ride")}`,
          notes: e.custom_notes || "User-added workout",
        };
        return (
          <div key={`e-${e.session_idx}`} className="relative">
            <SessionCard
              userId={user.id}
              weekIndex={wIdx}
              dayIndex={dIdx}
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

      {/* Add extra */}
      <div className="mb-4">
        <AddExtraSessionForm
          userId={user.id}
          weekIndex={wIdx}
          dayIndex={dIdx}
          nextSessionIdx={nextSessionIdx}
        />
      </div>


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
