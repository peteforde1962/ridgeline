"use client";

// Interactive day cell on /plan.
// Shows template sessions (with swap-aware type), user-added extras, and a note
// indicator. Click a session tag to cycle pending → done → skipped.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel, sessionTagClass } from "@/lib/plan";

export default function PlanDayCell({ userId, weekIndex, dayIndex, day, storedMap, extras = [], hasNote, dateLabel }) {
  const router = useRouter();
  const supabase = createClient();

  // Combined sessions = template + extras, each with their own state.
  const combined = [
    ...day.details.map((s, i) => ({
      key: `t-${i}`,
      sessionIdx: i,
      type: storedMap?.[i]?.swapped_to || s.type,
      label: sessionLabel(storedMap?.[i]?.swapped_to || s.type),
      isExtra: false,
      stored: storedMap?.[i],
    })),
    ...extras.map((e) => ({
      key: `e-${e.session_idx}`,
      sessionIdx: e.session_idx,
      type: e.swapped_to || "ride",
      label: e.custom_name || sessionLabel(e.swapped_to || "ride"),
      isExtra: true,
      stored: e,
    })),
  ];

  const [state, setState] = useState(() => {
    const out = {};
    combined.forEach((c) => {
      out[c.sessionIdx] = {
        completed: !!c.stored?.completed,
        tweak: c.stored?.tweak || "standard",
      };
    });
    return out;
  });
  const [busyIdx, setBusyIdx] = useState(null);

  function goToDay(e) {
    if (e.target.closest("[data-tag-button]")) return;
    router.push(`/plan/${weekIndex}/${dayIndex}`);
  }

  async function cycleSession(sessionIdx, isExtra, e) {
    e.stopPropagation();
    e.preventDefault();
    setBusyIdx(sessionIdx);
    const cur = state[sessionIdx];

    let next;
    if (!cur.completed && cur.tweak !== "skipped") {
      next = { completed: true,  tweak: "standard" };
    } else if (cur.completed) {
      next = { completed: false, tweak: "skipped" };
    } else {
      next = { completed: false, tweak: "standard" };
    }
    setState((s) => ({ ...s, [sessionIdx]: next }));

    const payload = {
      user_id: userId,
      week_index: weekIndex,
      day_index: dayIndex,
      session_idx: sessionIdx,
      completed: next.completed,
      tweak: next.tweak,
    };
    // For extras, also keep is_extra true so the row isn't mistaken for a template.
    if (isExtra) payload.is_extra = true;

    const { error } = await supabase
      .from("plan_sessions")
      .upsert(payload, { onConflict: "user_id,week_index,day_index,session_idx" });

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
      className="rounded-lg p-2 border border-[var(--line)] block transition hover:border-[var(--accent)] hover:bg-[var(--panel2)] cursor-pointer"
      style={{ background: "var(--panel)" }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{day.day}</div>
        <div className="flex items-center gap-1">
          {hasNote && <span title="Day has notes" className="text-[10px] text-[var(--accent3)]">✎</span>}
          {dateLabel && <span className="text-[10px] text-[var(--muted)]">{dateLabel}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {combined.length === 0 ? (
          <span className={`text-[11px] px-1 py-0.5 rounded ${sessionTagClass("rest")}`}>Rest</span>
        ) : (
          combined.map((c) => {
            const cur = state[c.sessionIdx] || { completed: false, tweak: "standard" };
            const isDone    = cur.completed;
            const isSkipped = cur.tweak === "skipped";
            const icon = isDone ? "✓" : isSkipped ? "✗" : "○";
            const iconColor = isDone ? "#4fa05f" : isSkipped ? "#d04e2c" : "var(--muted)";
            return (
              <button
                key={c.key}
                data-tag-button
                onClick={(e) => cycleSession(c.sessionIdx, c.isExtra, e)}
                disabled={busyIdx === c.sessionIdx}
                title={c.isExtra ? "User-added · click to cycle" : "Click to cycle: pending → done → skipped"}
                className={`text-[11px] px-1 py-0.5 rounded text-left transition flex items-center gap-1 ${sessionTagClass(c.type)}`}
                style={{ cursor: "pointer", opacity: isSkipped ? 0.55 : 1 }}
              >
                <span style={{ color: iconColor, fontWeight: 700 }}>{icon}</span>
                <span>{c.label}{c.isExtra && " +"}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
