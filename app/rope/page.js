import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FLOW_ROPE_DRILLS } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";

export default async function RopePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Flow Rope</h1>
      <p className="text-[var(--muted)] mb-6">
        Active mobility, coordination, and timing — translates directly to bike handling.
      </p>

      <section className="card">
        <h2 className="text-lg font-bold mb-2">15-minute flow rope session</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Use a weighted flow rope (or a jump rope with looser grip). Move smoothly — no death-gripping.
        </p>
        <div className="space-y-2">
          {FLOW_ROPE_DRILLS.map((d, i) => (
            <div key={d.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2,#1d2a23)", border: "1px solid var(--line)" }}>
              <div
                className="w-8 h-8 rounded-md grid place-items-center font-bold flex-shrink-0"
                style={{ background: "rgba(232,114,98,.2)", color: "#e87262" }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{d.name} <span className="text-[var(--muted)] font-normal">· {d.time}</span></div>
                <div className="text-sm text-[var(--muted)]">{d.focus}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
