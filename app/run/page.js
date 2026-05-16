import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RUN_SESSIONS } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";

export default async function RunPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Running (Cross-training)</h1>
      <p className="text-[var(--muted)] mb-6">
        Aerobic base + tendon health, without the pounding of heavy mileage.
      </p>

      <section className="card">
        <h2 className="text-lg font-bold mb-2">Run sessions</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Running is supplemental — 1–2× per week max during base & build phases.
        </p>
        <div className="space-y-2">
          {RUN_SESSIONS.map((s) => (
            <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2,#1d2a23)", border: "1px solid var(--line)" }}>
              <span className="text-xs px-2 py-1 rounded bg-[#a37650]/25 text-[#e3c094] border border-[#a37650]/60 flex-shrink-0">Run</span>
              <div className="flex-1">
                <div className="font-semibold">{s.name} — <span className="text-[var(--muted)] font-normal">{s.time}</span></div>
                <div className="text-sm text-[var(--muted)]">{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
