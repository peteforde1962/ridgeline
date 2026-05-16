import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { YOGA_WARMUP, YOGA_RECOVERY } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";

function PoseList({ poses }) {
  return (
    <div className="space-y-2">
      {poses.map((p, i) => (
        <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2,#1d2a23)", border: "1px solid var(--line)" }}>
          <div
            className="w-8 h-8 rounded-md grid place-items-center font-bold flex-shrink-0"
            style={{ background: "rgba(108,194,138,.2)", color: "#6cc28a" }}
          >
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{p.name}</div>
            <div className="text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">{p.reps}</span> — {p.why}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function YogaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Yoga & Mobility</h1>
      <p className="text-[var(--muted)] mb-6">
        Pre-ride dynamic warm-up + post-ride restorative. Hips, spine, chest, shoulders.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Pre-Ride Warm-up</h2>
            <span className="text-xs px-2 py-1 rounded bg-[#4e6851]/30 text-[#dcc9a9] border border-[#4e6851]/70">Dynamic</span>
          </div>
          <PoseList poses={YOGA_WARMUP} />
        </section>

        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Post-Ride Recovery</h2>
            <span className="text-xs px-2 py-1 rounded bg-[#4e6851]/30 text-[#dcc9a9] border border-[#4e6851]/70">Restorative</span>
          </div>
          <PoseList poses={YOGA_RECOVERY} />
        </section>
      </div>
    </main>
  );
}
