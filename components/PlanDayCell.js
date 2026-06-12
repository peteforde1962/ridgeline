"use client";

// Plan day cell with traffic-light status + icon-only session tags.
// Past day status:
//   • green  — all non-rest sessions done
//   • amber  — partially done (or today)
//   • red    — past with skipped or missed sessions
// Future days have no border tint.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionIconName, sessionColor, dateForDay } from "@/lib/plan";
import Icon from "@/lib/icons";

function statusColor(status) {
  return { green: "#5cb85c", amber: "#f0ad4e", red: "#d9534f", future: "var(--line)" }[status] || "var(--line)";
}

export default function PlanDayCell({ userId, weekIndex, dayIndex, day, storedMap, extras = [], hasNote, dateLabel, startedAt }) {
  const router = useRouter();
  const supabase = createClient();

  const combined = [
    ...day.details.map((s, i) => ({
      key: `t-${i}`,
      sessionIdx: i,
      type: storedMap?.[i]?.swapped_to || s.type,
      isExtra: false,
      stored: storedMap?.[i],
    })),
    ...extras.map((e) => ({
      key: `e-${e.session_idx}`,
      sessionIdx: e.session_idx,
      type: e.swapped_to || "ride",
      isExtra: true,
      stored: e,
    })),
  // Hide sessions the user deleted (template sessions marked tweak="removed").
  ].filter((c) => c.stored?.tweak !== "removed");

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

  // Compute traffic-light status.
  const dateStr = dateForDay(startedAt, weekIndex, dayIndex);
  const today = new Date(); today.setHours(0,0,0,0);
  const cellDate = dateStr ? new Date(dateStr + "T00:00:00") : null;
  const isPast   = cellDate && cellDate < today;
  const isToday  = cellDate && cellDate.getTime() === today.getTime();
  const isFuture = cellDate && cellDate > today;

  const nonRest = combined.filter((c) => c.type !== "rest");
  const doneCount    = nonRest.filter((c) => state[c.sessionIdx]?.completed).length;
  const skippedCount = nonRest.filter((c) => state[c.sessionIdx]?.tweak === "skipped").length;

  let status = "future";
  if (nonRest.length === 0) {
    status = isPast ? "green" : "future"; // rest days "done" if past
  } else if (isFuture) {
    status = "future";
  } else if (isToday) {
    status = doneCount === nonRest.length ? "green" : skippedCount > 0 ? "red" : "amber";
  } else if (isPast) {
    if (doneCount === nonRest.length) status = "green";
    else if (skippedCount > 0 || doneCount === 0) status = "red";
    else status = "amber";
  }
  const borderColor = statusColor(status);

  function goToDay(e) {
    if (e.target.closest("[data-tag-button]")) return;
    router.push(`/plan/${weekIndex}/${dayIndex}`);
  }

  async function cycleSession(sessionIdx, isExtra, e) {
    e.stopPropagation(); e.preventDefault();
    setBusyIdx(sessionIdx);
    const cur = state[sessionIdx];

    let next;
    if (!cur.completed && cur.tweak !== "skipped") next = { completed: true,  tweak: "standard" };
    else if (cur.completed)                          next = { completed: false, tweak: "skipped"  };
    else                                             next = { completed: false, tweak: "standard" };
    setState((s) => ({ ...s, [sessionIdx]: next }));

    const payload = {
      user_id: userId, week_index: weekIndex, day_index: dayIndex, session_idx: sessionIdx,
      completed: next.completed, tweak: next.tweak,
    };
    if (isExtra) payload.is_extra = true;

    const { error } = await supabase
      .from("plan_sessions")
      .upsert(payload, { onConflict: "user_id,week_index,day_index,session_idx" });

    setBusyIdx(null);
    if (error) { setState((s) => ({ ...s, [sessionIdx]: cur })); alert("Save failed: " + error.message); return; }
    router.refresh();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDay}
      onKeyDown={(e) => { if (e.key === "Enter") goToDay(e); }}
      className="rounded-lg p-2 block transition hover:opacity-95 cursor-pointer"
      style={{
        background: "var(--panel)",
        border: `2px solid ${borderColor}`,
      }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{day.day}</div>
        <div className="flex items-center gap-1">
          {hasNote && <span title="Day has notes" style={{ color: "var(--accent)" }} className="text-[10px]">✎</span>}
          {dateLabel && <span className="text-[10px] text-[var(--muted)]">{dateLabel}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {combined.length === 0 ? (
          <span className="text-[10px] text-[var(--muted)]">Rest</span>
        ) : (
          combined.map((c) => {
            const cur = state[c.sessionIdx] || { completed: false, tweak: "standard" };
            const isDone    = cur.completed;
            const isSkipped = cur.tweak === "skipped";
            const color = isDone ? "#5cb85c" : isSkipped ? "#d9534f" : sessionColor(c.type);
            return (
              <button
                key={c.key}
                data-tag-button
                onClick={(e) => cycleSession(c.sessionIdx, c.isExtra, e)}
                disabled={busyIdx === c.sessionIdx}
                title={`${c.type}${c.isExtra ? " (extra)" : ""} · ${isDone ? "done" : isSkipped ? "skipped" : "pending"}`}
                className="rounded-md p-1 flex items-center justify-center transition"
                style={{
                  background: isDone ? "rgba(92,184,92,.18)" :
                              isSkipped ? "rgba(217,83,79,.18)" :
                              "rgba(255,255,255,0.05)",
                  border: `1px solid ${color}`,
                  cursor: "pointer",
                }}
              >
                <Icon name={sessionIconName(c.type)} size={14} stroke={color} />
                {c.isExtra && <span className="text-[9px] ml-0.5" style={{ color }}>+</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
