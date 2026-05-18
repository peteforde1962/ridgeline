"use client";

// Interactive day cell on /plan with ✓/✗ icons (no strikethrough).
// - Click a session tag → cycle: pending → done → skipped → pending.
// - Click anywhere else → drill into the day detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel, sessionTagClass } from "@/lib/plan";

export default function PlanDayCell({ userId, weekIndex, dayIndex, day, storedMap, dateLabel }) {
  const router = useRouter();
  const supabase = createClient();

  // Build initial state per session: {completed, tweak}
  const [state, setState] = useState(() => {
    const out = {};
    day.details.forEach((_, i) => {
      const row = storedMap?.[i];
      out[i] = {
        completed: !!row?.completed,
        tweak: row?.tweak || "standard",
      };
    });
    return out;
  });
  const [busyIdx, setBusyIdx] = useState(null);

  function goToDay(e) {
    if (e.target.closest("[data-tag-button]")) return;
    router.push(`/plan/${weekIndex}/${dayIndex}`);
  }

  async function cycleSession(sessionIdx, e) {
    e.stopPropagation();
    e.preventDefault();
    setBusyIdx(sessionIdx);
    const cur = state[sessionIdx];

    // Cycle: pending → done → skipped → pending
    let next;
    if (!cur.completed && cur.tweak !== "skipped") {
      next = { completed: true,  tweak: "standard" };  // → done
    } else if (cur.completed) {
      next = { completed: false, tweak: "skipped" };   // → skipped
    } else {
      next = { completed: false, tweak: "standard" };  // → pending
    }
    setState((s) => ({ ...s, [sessionIdx]: next }));

    const { error } = await supabase
      .from("plan_sessions")
      .upsert(
        {
          user_id: userId,
          week_index: weekIndex,
          day_index: dayIndex,
          session_idx: sessionIdx,
          completed: next.completed,
          tweak: next.tweak,
        },
        { onConflict: "user_id,week_index,day_index,session_idx" }
      );
    setBusyIdx(null);
    if (error) {
      setState((s) => ({ ...s, [sessionIdx]: cur }));
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
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{day.day}</div>
        {dateLabel && <div className="text-[10px] text-[var(--muted)]">{dateLabel}</div>}
      </div>
      <div className="flex flex-col gap-1">
        {day.details.length === 0 ? (
          <span className={`text-[11px] px-1 py-0.5 rounded ${sessionTagClass("rest")}`}>Rest</span>
        ) : (
          day.details.map((s, si) => {
            const cur = state[si];
            const isDone = cur.completed;
            const isSkipped = cur.tweak === "skipped";
            const icon = isDone ? "✓" : isSkipped ? "✗" : "○";
            const iconColor = isDone ? "#6a8a6d" : isSkipped ? "#d76a4a" : "var(--muted)";
            return (
              <button
                key={si}
                data-tag-button
                onClick={(e) => cycleSession(si, e)}
                disabled={busyIdx === si}
                title="Click to cycle: pending → done → skipped"
                className={`text-[11px] px-1 py-0.5 rounded text-left transition flex items-center gap-1 ${sessionTagClass(s.type)}`}
                style={{ cursor: "pointer", opacity: isSkipped ? 0.55 : 1 }}
              >
                <span style={{ color: iconColor, fontWeight: 700 }}>{icon}</span>
                <span>{sessionLabel(s.type)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
