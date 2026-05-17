"use client";

// Interactive day cell on /plan.
// - Click an inline session tag → toggle done (stops propagation, so it does NOT navigate).
// - Click anywhere else on the cell → navigate to the day's detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel, sessionTagClass } from "@/lib/plan";

export default function PlanDayCell({ userId, weekIndex, dayIndex, day, storedMap }) {
  const router = useRouter();
  const supabase = createClient();

  // local optimistic state, keyed by session_idx
  const [done, setDone] = useState(() => {
    const out = {};
    day.details.forEach((_, i) => {
      out[i] = !!storedMap?.[i]?.completed;
    });
    return out;
  });
  const [busyIdx, setBusyIdx] = useState(null);

  function goToDay(e) {
    // Only navigate if the click target isn't an inline tag button.
    if (e.target.closest("[data-tag-button]")) return;
    router.push(`/plan/${weekIndex}/${dayIndex}`);
  }

  async function toggleSession(sessionIdx, e) {
    e.stopPropagation();
    e.preventDefault();
    setBusyIdx(sessionIdx);
    const next = !done[sessionIdx];
    setDone((d) => ({ ...d, [sessionIdx]: next }));
    const { error } = await supabase
      .from("plan_sessions")
      .upsert(
        {
          user_id: userId,
          week_index: weekIndex,
          day_index: dayIndex,
          session_idx: sessionIdx,
          completed: next,
          tweak: storedMap?.[sessionIdx]?.tweak || "standard",
        },
        { onConflict: "user_id,week_index,day_index,session_idx" }
      );
    setBusyIdx(null);
    if (error) {
      // revert on failure
      setDone((d) => ({ ...d, [sessionIdx]: !next }));
      alert("Save failed: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDay}
      onKeyDown={(e) => { if (e.key === "Enter") goToDay(e); }}
      className="rounded-lg p-2 border border-[var(--line)] block transition hover:border-[var(--accent)] hover:bg-[#3a4838] cursor-pointer"
      style={{ background: "var(--panel2)" }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">{day.day}</div>
      <div className="flex flex-col gap-1">
        {day.details.length === 0 ? (
          <span className={`text-[11px] px-1 py-0.5 rounded ${sessionTagClass("rest")}`}>Rest</span>
        ) : (
          day.details.map((s, si) => {
            const isDone = !!done[si];
            return (
              <button
                key={si}
                data-tag-button
                onClick={(e) => toggleSession(si, e)}
                disabled={busyIdx === si}
                title={isDone ? "Click to undo" : "Click to mark done"}
                className={`text-[11px] px-1 py-0.5 rounded text-left transition ${sessionTagClass(s.type)}`}
                style={{
                  opacity: isDone ? 0.5 : 1,
                  textDecoration: isDone ? "line-through" : "none",
                  cursor: "pointer",
                  border: "1px solid transparent",
                }}
              >
                {sessionLabel(s.type)}{isDone ? " ✓" : ""}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
