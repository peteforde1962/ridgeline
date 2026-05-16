"use client";

// One workout. Intensity buttons (easier/standard/harder/skipped) + mark complete.
// Writes state to the `plan_sessions` table.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel, sessionTagClass, scaleSessionName } from "@/lib/plan";

export default function SessionCard({ userId, weekIndex, dayIndex, sessionIdx, session, stored }) {
  const router = useRouter();
  const supabase = createClient();

  const [completed, setCompleted] = useState(!!stored?.completed);
  const [tweak, setTweak] = useState(stored?.tweak || "standard");
  const [busy, setBusy] = useState(false);

  const isSkipped = tweak === "skipped";
  const displayedName = isSkipped
    ? `(skipped) ${session.name}`
    : scaleSessionName(session.name, tweak);

  async function persist(next) {
    setBusy(true);
    const { error } = await supabase
      .from("plan_sessions")
      .upsert(
        {
          user_id: userId,
          week_index: weekIndex,
          day_index: dayIndex,
          session_idx: sessionIdx,
          completed: next.completed ?? completed,
          tweak: next.tweak ?? tweak,
        },
        { onConflict: "user_id,week_index,day_index,session_idx" }
      );
    setBusy(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    router.refresh();
  }

  async function toggleComplete() {
    const next = !completed;
    setCompleted(next);
    await persist({ completed: next });
  }

  async function setTweakOpt(opt) {
    setTweak(opt);
    await persist({ tweak: opt });
  }

  return (
    <div className="card mb-3" style={{ opacity: isSkipped ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(session.type)}`}>
            {sessionLabel(session.type)}
          </span>
          <h3 className="font-bold text-base" style={{ textDecoration: completed ? "line-through" : "none" }}>
            {displayedName} {completed && "✓"}
          </h3>
        </div>
        <button
          onClick={toggleComplete} disabled={busy}
          className={completed ? "btn-ghost" : "btn-primary"}
          style={{ padding: "6px 12px", fontSize: 13 }}
        >
          {completed ? "Undo" : "Mark done"}
        </button>
      </div>

      {session.notes && (
        <p className="text-sm text-[var(--muted)] mb-3">{session.notes}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {["easier", "standard", "harder"].map((opt) => (
          <button
            key={opt}
            onClick={() => setTweakOpt(opt)}
            disabled={busy}
            className={tweak === opt && !isSkipped ? "btn-primary" : "btn-ghost"}
            style={{ padding: "5px 10px", fontSize: 12 }}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setTweakOpt(isSkipped ? "standard" : "skipped")}
          disabled={busy}
          className="btn-ghost"
          style={{ padding: "5px 10px", fontSize: 12 }}
        >
          {isSkipped ? "Un-skip" : "Skip"}
        </button>
      </div>
    </div>
  );
}
