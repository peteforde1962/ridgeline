// /checkin — daily body check-in.
// Server-renders: load today's check-in (if any) + recent history, then hand off to the form.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";
import { todayDateInTz } from "@/lib/plan";
import CheckinForm from "@/components/CheckinForm";

export default async function CheckinPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use the user's stored IANA timezone so this matches the dashboard's
  // "today" date. UTC vs local mismatch is the most common cause of
  // "I saved a check-in but the dashboard still shows the old one".
  const { data: profile } = await supabase
    .from("profiles").select("timezone").eq("id", user.id).single();
  const today = todayDateInTz(profile?.timezone);

  // Today's existing check-in (if any)
  const { data: todayCheckin } = await supabase
    .from("check_ins")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  // Last 14 days of history
  const { data: history } = await supabase
    .from("check_ins")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(14);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
          ← Dashboard
        </a>
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <h1 className="text-3xl font-extrabold mb-1">Body Check-in</h1>
      <p className="text-[var(--muted)] mb-6">
        Daily readiness. Your check-in tunes today's intensity automatically.
      </p>

      <div className="mb-6">
        <CheckinForm userId={user.id} todayCheckin={todayCheckin} today={today} />
      </div>

      <section className="card-glass">
        <h2 className="text-lg font-bold mb-3">Recent check-ins</h2>
        {!history || history.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">
            No history yet. Save your first check-in above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Sleep</th>
                  <th className="text-left p-2">Soreness</th>
                  <th className="text-left p-2">Energy</th>
                  <th className="text-left p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--line)]">
                    <td className="p-2 whitespace-nowrap">{c.date}</td>
                    <td className="p-2">{c.sleep}</td>
                    <td className="p-2">{c.soreness}</td>
                    <td className="p-2">{c.energy}</td>
                    <td className="p-2 text-[var(--muted)]">{c.notes || ""}</td>
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
