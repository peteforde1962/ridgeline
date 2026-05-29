// /coaching/students/[id] — full overview of one student.
// Shows: plan progress, recent rides, last check-ins, all videos.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";

export default async function StudentDetail({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify the requester is a coach AND owns this student. RLS will also block,
  // but we redirect cleanly if they sneak the URL.
  const { data: me } = await supabase.from("profiles").select("role, coach_approved").eq("id", user.id).single();
  if (me?.role !== "coach" || !me?.coach_approved) redirect("/profile");

  // RLS will only return this row if coach_id = current coach.
  const { data: student } = await supabase
    .from("profiles")
    .select("id, name, email, preset, level, weekly_hours, goal, race_date, plan_weeks, started_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!student) notFound();

  const [{ data: rides }, { data: checkins }, { data: videos }] = await Promise.all([
    supabase.from("rides")
      .select("id, date, km, minutes, elev_m, feel, notes")
      .eq("user_id", student.id)
      .order("date", { ascending: false }).limit(10),
    supabase.from("check_ins")
      .select("date, sleep, soreness, energy, notes")
      .eq("user_id", student.id)
      .order("date", { ascending: false }).limit(7),
    supabase.from("videos")
      .select("id, name, type, date, kind")
      .eq("user_id", student.id)
      .order("date", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <a href="/coaching" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← All students</a>

      <h1 className="text-3xl font-extrabold mt-2 mb-1">{student.name || student.email}</h1>
      <p className="text-[var(--muted)] mb-6">
        {student.preset} · {student.level} · {student.weekly_hours}h/week · {student.goal}
        {student.race_date && ` · race ${student.race_date}`}
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Videos ({videos?.length || 0})</h2>
        {(!videos || videos.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No videos uploaded.</p>
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

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Recent rides</h2>
        {(!rides || rides.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No rides logged.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="p-3">Date</th><th>Km</th><th>Min</th><th>Elev</th><th>Feel</th><th className="pr-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="p-3">{r.date}</td>
                    <td>{r.km || "—"}</td>
                    <td>{r.minutes || "—"}</td>
                    <td>{r.elev_m || "—"}</td>
                    <td>{r.feel || "—"}/5</td>
                    <td className="pr-3 truncate max-w-xs">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Last 7 check-ins</h2>
        {(!checkins || checkins.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No check-ins.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
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
