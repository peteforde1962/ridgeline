// /coaching/students/[id] — full overview of one student.
// Shows: plan progress, training load, recent rides, last check-ins, videos,
// plus the coach's own tools: prescribe a workout, upload a video for them.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex } from "@/lib/plan";
import { trainingLoadSeries, currentLoad, formInterpretation } from "@/lib/training-load";
import PageHeader from "@/components/PageHeader";
import CoachPrescribeWorkout from "@/components/CoachPrescribeWorkout";
import CoachVideoUpload from "@/components/CoachVideoUpload";

export default async function StudentDetail({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, coach_approved").eq("id", user.id).single();
  if (me?.role !== "coach" || !me?.coach_approved) redirect("/profile");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, name, email, preset, level, weekly_hours, goal, race_date, plan_weeks, started_at, ftp, lthr, hr_max, timezone")
    .eq("id", params.id)
    .maybeSingle();
  if (!student) notFound();

  const thirty = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const seven  = new Date(Date.now() -  7 * 86400_000).toISOString().slice(0, 10);

  const [
    { data: rides },
    { data: checkins },
    { data: videos },
    { data: allRides },
    { data: planSessions },
  ] = await Promise.all([
    supabase.from("rides")
      .select("id, date, km, minutes, elev_m, feel, notes, avg_hr, weighted_avg_watts, suffer_score")
      .eq("user_id", student.id)
      .gte("date", thirty)
      .order("date", { ascending: false }),
    supabase.from("check_ins")
      .select("date, sleep, soreness, energy, notes")
      .eq("user_id", student.id)
      .gte("date", seven)
      .order("date", { ascending: false }),
    supabase.from("videos")
      .select("id, name, type, date, kind")
      .eq("user_id", student.id)
      .order("date", { ascending: false }),
    supabase.from("rides")
      .select("date, km, elev_m, minutes, avg_hr, avg_watts, weighted_avg_watts, suffer_score")
      .eq("user_id", student.id),
    supabase.from("plan_sessions")
      .select("week_index, day_index, session_idx, completed")
      .eq("user_id", student.id),
  ]);

  // Plan progress.
  const plan = buildPlan(student);
  const wIdx = currentWeekIndex(student?.started_at, plan.length);
  const week = plan[wIdx];
  const completedThisWeek = (planSessions || []).filter((s) => s.week_index === wIdx && s.completed).length;
  const scheduledThisWeek = week
    ? week.days.reduce((a, d) => a + d.details.filter((s) => s.type !== "rest").length, 0)
    : 0;
  const overallDone = (planSessions || []).filter((s) => s.completed).length;
  const totalScheduled = plan.reduce((a, w) => a + w.days.reduce((b, d) => b + d.details.filter((s) => s.type !== "rest").length, 0), 0);

  // Training load.
  const loadSeries = trainingLoadSeries(allRides || [], 60, student);
  const load = currentLoad(loadSeries);
  const form = formInterpretation(load.form);

  // 30-day distance + time totals.
  const kmTotal  = (rides || []).reduce((a, r) => a + (+r.km || 0), 0);
  const minTotal = (rides || []).reduce((a, r) => a + (+r.minutes || 0), 0);
  const elevTotal = (rides || []).reduce((a, r) => a + (+r.elev_m || 0), 0);

  const studentName = student.name || student.email.split("@")[0];

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <a href="/coaching" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← All students</a>

      <h1 className="text-3xl font-extrabold mt-2 mb-1">{studentName}</h1>
      <p className="text-[var(--muted)] mb-6">
        {student.preset} · {student.level} · {student.weekly_hours}h/week · {student.goal}
        {student.race_date && ` · race ${student.race_date}`}
      </p>

      {/* --- Snapshot KPIs --- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="This week" v={`${completedThisWeek}/${scheduledThisWeek}`} sub="sessions" />
        <Stat label="Plan progress" v={`${overallDone}/${totalScheduled}`} sub={`${totalScheduled ? Math.round(100 * overallDone / totalScheduled) : 0}%`} />
        <Stat label="Last 30d distance" v={`${kmTotal.toFixed(1)} km`} sub={`${(rides || []).length} rides`} />
        <Stat label="Last 30d climbing" v={`${elevTotal.toLocaleString()} m`} sub={`${Math.round(minTotal / 60)} hr saddle`} />
      </section>

      {/* --- Training load --- */}
      <section className="card-glass mb-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Training load</h2>
          <span className="text-xs px-2 py-0.5 rounded"
                style={{ background: `${form.color}22`, color: form.color, border: `1px solid ${form.color}66` }}>
            {form.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <LoadStat label="Fitness (CTL)" v={load.fitness} color="#5fa7c4" />
          <LoadStat label="Fatigue (ATL)" v={load.fatigue} color="#f0ad4e" />
          <LoadStat label="Form (TSB)"    v={load.form}    color={form.color} />
        </div>
      </section>

      {/* --- Coach actions --- */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CoachPrescribeWorkout studentId={student.id} studentName={studentName} />
        <CoachVideoUpload      studentId={student.id} studentName={studentName} />
      </section>

      {/* --- Videos --- */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Videos ({videos?.length || 0})</h2>
        {(!videos || videos.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No videos yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {videos.map((v) => (
              <a key={v.id} href={`/coaching/students/${student.id}/videos/${v.id}`}
                 className="card hover:opacity-90">
                <div className="font-bold">{v.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {v.type} · {v.date} · {v.kind === "upload" ? "uploaded" : "linked"}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* --- Rides (30 days) --- */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Rides · last 30 days</h2>
        {(!rides || rides.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No rides logged.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="p-3">Date</th><th>Km</th><th>Min</th><th>Elev</th><th>HR / W</th><th>Feel</th><th className="pr-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="p-3"><a href={`/rides/${r.id}`} className="text-[var(--accent)]">{r.date.slice(5)}</a></td>
                    <td>{r.km || "—"}</td>
                    <td>{r.minutes || "—"}</td>
                    <td>{r.elev_m || "—"}</td>
                    <td className="text-xs text-[var(--muted)]">
                      {r.avg_hr ? `${r.avg_hr}bpm` : "—"}
                      {r.weighted_avg_watts ? ` / ${r.weighted_avg_watts}W` : ""}
                    </td>
                    <td>{r.feel ? `${r.feel}/5` : "—"}</td>
                    <td className="pr-3 truncate max-w-xs">{r.notes ? r.notes.split(" · ")[0] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Check-ins --- */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Check-ins · last 7 days</h2>
        {(!checkins || checkins.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No check-ins.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="p-3">Date</th><th>Sleep</th><th>Soreness</th><th>Energy</th><th className="pr-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.date} className="border-t border-[var(--line)]">
                    <td className="p-3">{c.date}</td>
                    <td>{c.sleep}/10</td>
                    <td>{c.soreness}/10</td>
                    <td>{c.energy}/10</td>
                    <td className="pr-3 truncate max-w-xs">{c.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, v, sub }) {
  return (
    <div className="card">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-xl font-extrabold">{v}</div>
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

function LoadStat({ label, v, color }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color }}>{v.toFixed(1)}</div>
    </div>
  );
}
