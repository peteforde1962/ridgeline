"use client";

// One workout. Intensity controls + mark done/skipped + change session type.
// Writes state to plan_sessions.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel, sessionTagClass, scaleSessionName } from "@/lib/plan";

const SWAPPABLE_TYPES = ["ride", "strength", "yoga", "run", "rope", "rest"];

export default function SessionCard({ userId, weekIndex, dayIndex, sessionIdx, session, stored }) {
  const router = useRouter();
  const supabase = createClient();

  const [completed, setCompleted] = useState(!!stored?.completed);
  const [tweak, setTweak]         = useState(stored?.tweak || "standard");
  const [swappedTo, setSwappedTo] = useState(stored?.swapped_to || null);
  const [busy, setBusy]           = useState(false);
  const [showSwap, setShowSwap]   = useState(false);

  const effectiveType = swappedTo || session.type;
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
          swapped_to: next.swapped_to !== undefined ? next.swapped_to : swappedTo,
        },
        { onConflict: "user_id,week_index,day_index,session_idx" }
      );
    setBusy(false);
    if (error) { alert("Save failed: " + error.message); return; }
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
  async function swapType(newType) {
    setSwappedTo(newType);
    setShowSwap(false);
    await persist({ swapped_to: newType });
  }

  const status = completed ? "done" : isSkipped ? "skipped" : "pending";
  const statusIcon = status === "done" ? "✓" : status === "skipped" ? "✗" : "○";
  const statusColor = status === "done" ? "#6a8a6d" : status === "skipped" ? "#d76a4a" : "var(--muted)";

  return (
    <div className="card mb-3" style={{ opacity: isSkipped ? 0.7 : 1 }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(effectiveType)}`}>
            {sessionLabel(effectiveType)}{swappedTo && <span className="text-[10px] ml-1 opacity-70">(swapped)</span>}
          </span>
          <h3 className="font-bold text-base">
            <span style={{ color: statusColor, marginRight: 6, fontWeight: 900 }}>{statusIcon}</span>
            {displayedName}
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

      <div className="flex flex-wrap gap-2 items-center mb-2">
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
        <button
          onClick={() => setShowSwap(!showSwap)}
          disabled={busy}
          className="btn-ghost"
          style={{ padding: "5px 10px", fontSize: 12 }}
        >
          🔄 Change type
        </button>
        {detailsLink(effectiveType) && (
          <a href={detailsLink(effectiveType)} className="btn-ghost text-xs ml-auto" style={{ padding: "5px 10px" }}>
            Open details →
          </a>
        )}
      </div>

      {showSwap && (
        <div className="mt-2 p-2 rounded-lg" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <div className="text-xs text-[var(--muted)] mb-2">Replace this session with…</div>
          <div className="flex flex-wrap gap-2">
            {SWAPPABLE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => swapType(t === session.type ? null : t)}
                disabled={busy}
                className={effectiveType === t ? "btn-primary" : "btn-ghost"}
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                {sessionLabel(t)}
              </button>
            ))}
            {swappedTo && (
              <button
                onClick={() => swapType(null)}
                disabled={busy}
                className="btn-ghost"
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                Restore original ({sessionLabel(session.type)})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function detailsLink(type) {
  return ({
    strength: "/strength",
    yoga: "/yoga",
    run: "/run",
    rope: "/rope",
    ride: "/trails",
  })[type] || null;
}
