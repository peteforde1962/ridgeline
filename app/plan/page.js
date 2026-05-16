// /plan — full N-week plan, with a tag per session per day.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, sessionLabel, sessionTagClass, PHASES } from "@/lib/plan";

export default async function PlanPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  // Pull all completed sessions to mark them in the grid.
  const { data: completed } = await supabase
    .from("plan_sessions").select("week_index,day_index,session_idx,completed,tweak")
    .eq("user_id", user.id).eq("completed", true);

  const completedSet = new Set(
    (completed || []).map((c) => `${c.week_index}-${c.day_index}-${c.session_idx}`)
  );

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile?.started_at, plan.length);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
        <div className="flex items-center gap-2">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <h1 className="text-3xl font-extrabold mb-1">{plan.length}-Week Plan</h1>
      <p className="text-[var(--muted)] mb-5">
        Base → Build → Peak → Race → Recovery. Adjust hours and plan length in Profile.
      </p>

      {/* Phase strip */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {PHASES.map((p) => {
          const isCurrent = plan[wIdx]?.phase === p.key;
          return (
            <div
              key={p.key}
              className={`p-3 rounded-lg text-center ${isCurrent ? "border-2" : "border"}`}
              style={{
                background: isCurrent ? "rgba(255,122,41,.10)" : "var(--panel)",
                borderColor: isCurrent ? "var(--accent)" : "var(--line)",
              }}
            >
              <div className="font-bold text-sm">{p.name}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{p.weeks} wk</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5 text-xs">
        {["ride","strength","yoga","run","rope","rest"].map((t) => (
          <span key={t} className={`px-2 py-1 rounded ${sessionTagClass(t)}`}>
            {sessionLabel(t)}
          </span>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-4">
        {plan.map((w, i) => {
          const isCurrent = i === wIdx;
          return (
            <div
              key={w.week}
              className="card"
              style={{
                borderColor: isCurrent ? "var(--accent)" : "var(--line)",
                borderWidth: isCurrent ? 2 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">
                  Week {w.week} <span className="text-[var(--muted)] font-normal">— {w.phaseName}</span>
                </div>
                {isCurrent && (
                  <span className="text-xs font-bold px-2 py-1 rounded bg-[#b83a2d]/20 text-[#dcc9a9] border border-[#b83a2d]/60">
                    Current
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {w.days.map((d, di) => (
                  <a
                    key={di}
                    href={`/plan/${i}/${di}`}
                    className="rounded-lg p-2 border border-[var(--line)] block transition hover:border-[var(--accent)] hover:bg-[#3a4838]"
                    style={{ background: "var(--panel2)" }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">{d.day}</div>
                    <div className="flex flex-col gap-1">
                      {d.details.length === 0 ? (
                        <span className={`text-[11px] px-1 py-0.5 rounded ${sessionTagClass("rest")}`}>Rest</span>
                      ) : (
                        d.details.map((s, si) => {
                          const key = `${i}-${di}-${si}`;
                          const isDone = completedSet.has(key);
                          return (
                            <span
                              key={si}
                              className={`text-[11px] px-1 py-0.5 rounded ${sessionTagClass(s.type)}`}
                              style={{ opacity: isDone ? 0.55 : 1, textDecoration: isDone ? "line-through" : "none" }}
                            >
                              {sessionLabel(s.type)}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
