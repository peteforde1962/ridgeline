// /coaching — coach-only home. Shows your student roster.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";

export default async function CoachingHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "coach") redirect("/profile?become=coach");

  const { data: students } = await supabase
    .from("profiles")
    .select("id, name, email, level, goal, race_date")
    .eq("coach_id", user.id)
    .order("name");

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Coaching</h1>
      <p className="text-[var(--muted)] mb-6">
        {students?.length || 0} student{students?.length === 1 ? "" : "s"} connected.
        Share your invite code <code className="px-2 py-0.5 rounded"
          style={{ background: "var(--surface2,#1a3d3d)", color: "var(--accent2,#f4b860)" }}>
          {profile.coach_code || "—"}
        </code> to add more.
      </p>

      {(!students || students.length === 0) ? (
        <div className="card text-center">
          <p className="text-[var(--muted)]">
            No students yet. Send them your invite code from the <a href="/profile" className="text-[var(--accent)]">Profile</a> page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {students.map((s) => (
            <a key={s.id} href={`/coaching/students/${s.id}`}
               className="card hover:opacity-90 transition-opacity">
              <div className="font-bold">{s.name || s.email}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {s.level || "—"} · {s.goal || "—"}{s.race_date ? ` · race ${s.race_date}` : ""}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
