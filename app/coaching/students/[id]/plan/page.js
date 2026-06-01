// /coaching/students/[id]/plan — full plan grid for a student, coach view.
// Each day cell shows scheduled sessions + extras + prescribed (with coach badge).
// Click a day to open the day editor.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlan, currentWeekIndex, sessionLabel, sessionTagClass, PHASES,
  dateForDay, formatShortDate,
} from "@/lib/plan";
import PageHeader from "@/components/PageHeader";
import Icon from "@/lib/icons";

export default async function CoachPlanView({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, coach_approved").eq("id", user.id).single();
  if (me?.role !== "coach" || !me?.coach_approved) redirect("/profile");

  const { data: student } = await supabase
    .from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!student) notFound();

  const { data: allSessions } = await supabase
    .from("plan_sessions")
    .select("id,week_index,day_index,session_idx,completed,tweak,swapped_to,is_extra,custom_name,prescribed_by_coach_id")
    .eq("user_id", student.id);

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

  const plan = buildPlan(student);
  const wIdx = currentWeekIndex(student?.started_at, plan.length);
  const studentName = student.name || student.email.split("@")[0];

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <a href={`/coaching/students/${student.id}`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← {studentName}
      </a>

      <h1 className="text-3xl font-extrabold mt-2 mb-1">{studentName}'s plan</h1>
      <p className="text-[var(--muted)] mb-6">
        Click any day to view, edit, or delete sessions. Coach-prescribed sessions are marked with the peach star.
      </p>

      {plan.map((week, weekI) => {
        const isCurrent = weekI === wIdx;
        return (
          <section key={weekI} className="mb-5">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: isCurrent ? "var(--accent)" : "var(--muted)" }}>
                Week {week.week} · {week.phaseName}{isCurrent && " · current"}
              </h2>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {week.days.map((day, dayI) => {
                const key = `${weekI}-${dayI}`;
                const templateSlots = day.details.map((s, si) => ({
                  type: sessionsByDay[key]?.[si]?.swapped_to || s.type,
                  done: !!sessionsByDay[key]?.[si]?.completed,
                  skipped: sessionsByDay[key]?.[si]?.tweak === "skipped",
                  name: sessionsByDay[key]?.[si]?.custom_name || s.name,
                }));
                const extras = (extrasByDay[key] || []).map((e) => ({
                  type: e.swapped_to || "ride",
                  done: !!e.completed,
                  name: e.custom_name || sessionLabel(e.swapped_to || "ride"),
                  prescribed: !!e.prescribed_by_coach_id,
                }));
                const date = dateForDay(student.started_at, weekI, dayI);

                return (
                  <a key={dayI}
                     href={`/coaching/students/${student.id}/plan/${weekI}/${dayI}`}
                     className="rounded-lg p-2 hover:opacity-90 transition-opacity"
                     style={{
                       background: "var(--panel)",
                       border: isCurrent && dayI === new Date().getDay() ? "1px solid var(--accent)" : "1px solid var(--line)",
                       minHeight: 96,
                     }}>
                    <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] mb-1 flex justify-between">
                      <span>{day.day.slice(0, 3)}</span>
                      <span>{formatShortDate(date)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {templateSlots.length === 0 && extras.length === 0 && (
                        <span className="text-[10px] text-[var(--muted)] italic">Rest</span>
                      )}
                      {templateSlots.map((s, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${sessionTagClass(s.type)} ${s.skipped ? "opacity-50 line-through" : ""}`}>
                          {s.done && "✓ "}{sessionLabel(s.type)}
                        </span>
                      ))}
                      {extras.map((e, i) => (
                        <span key={`e-${i}`} className={`text-[10px] px-1.5 py-0.5 rounded ${sessionTagClass(e.type)} flex items-center gap-1`}>
                          {e.prescribed && <Icon name="star" size={9} stroke="var(--accent)" />}
                          {e.done && "✓ "}{sessionLabel(e.type)}
                        </span>
                      ))}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
