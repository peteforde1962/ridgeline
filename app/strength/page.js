import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STRENGTH_WORKOUTS } from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";

export default async function StrengthPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Strength</h1>
      <p className="text-[var(--muted)] mb-6">
        Cycling-specific lifts. Build power, durability, resist injury.
      </p>

      <div className="space-y-4">
        {STRENGTH_WORKOUTS.map((w) => (
          <section key={w.name} className="card">
            <h2 className="text-lg font-bold mb-3">{w.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                    <th className="text-left p-2">Exercise</th>
                    <th className="text-left p-2">Sets × Reps</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {w.blocks.map((b) => (
                    <tr key={b.name} className="border-t border-[var(--line)]">
                      <td className="p-2 font-semibold">{b.name}</td>
                      <td className="p-2 whitespace-nowrap">{b.sets}</td>
                      <td className="p-2 text-[var(--muted)]">{b.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
