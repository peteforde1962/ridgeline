"use client";

// One workout card. Now supports:
//   - cycle status (done/skip)
//   - per-session intensity + skip
//   - swap type
//   - generate detailed AI workout
//   - link to actual ride if ride_id is attached (Strava auto-import)

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
  const [aiWorkout, setAiWorkout] = useState(stored?.ai_workout || null);
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiBusy, setAiBusy]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [showSwap, setShowSwap]   = useState(false);

  const effectiveType = swappedTo || session.type;
  const isSkipped = tweak === "skipped";
  const displayedName = isSkipped ? `(skipped) ${session.name}` : scaleSessionName(session.name, tweak);
  const linkedRideId = stored?.ride_id;

  async function persist(next) {
    setBusy(true);
    const { error } = await supabase
      .from("plan_sessions")
      .upsert(
        {
          user_id: userId, week_index: weekIndex, day_index: dayIndex, session_idx: sessionIdx,
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
  async function toggleComplete() { const next = !completed; setCompleted(next); await persist({ completed: next }); }
  async function setTweakOpt(opt) { setTweak(opt); await persist({ tweak: opt }); }
  async function swapType(newType) { setSwappedTo(newType); setShowSwap(false); await persist({ swapped_to: newType }); }

  async function generateWorkout() {
    setAiBusy(true); setAiOpen(true);
    try {
      const res = await fetch("/api/plan/workout-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekIndex, dayIndex, sessionIdx,
          sessionType: effectiveType,
          sessionName: session.name,
          force: !!aiWorkout,
        }),
      });
      const data = await res.json();
      if (data.workout) setAiWorkout(data.workout);
      else if (data.error) alert(data.error);
    } catch (e) { alert("Failed: " + e.message); }
    setAiBusy(false);
  }

  const status = completed ? "done" : isSkipped ? "skipped" : "pending";
  const statusIcon = status === "done" ? "✓" : status === "skipped" ? "✗" : "○";
  const statusColor = status === "done" ? "#5cb85c" : status === "skipped" ? "#d9534f" : "var(--muted)";

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

      {session.notes && <p className="text-sm text-[var(--muted)] mb-3">{session.notes}</p>}

      <div className="flex flex-wrap gap-2 items-center mb-2">
        {["easier", "standard", "harder"].map((opt) => (
          <button key={opt} onClick={() => setTweakOpt(opt)} disabled={busy}
            className={tweak === opt && !isSkipped ? "btn-primary" : "btn-ghost"}
            style={{ padding: "5px 10px", fontSize: 12 }}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
        <button onClick={() => setTweakOpt(isSkipped ? "standard" : "skipped")} disabled={busy}
          className="btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }}>
          {isSkipped ? "Un-skip" : "Skip"}
        </button>
        <button onClick={() => setShowSwap(!showSwap)} disabled={busy} className="btn-ghost"
          style={{ padding: "5px 10px", fontSize: 12 }}>
          🔄 Change type
        </button>
        {/* AI workout button — only for "trainable" types */}
        {effectiveType !== "rest" && (
          <button onClick={generateWorkout} disabled={aiBusy} className="btn-ghost text-xs ml-auto"
            style={{ padding: "5px 10px" }}>
            {aiBusy ? "Generating…" : aiWorkout ? "Show workout details" : "🤖 Get workout from Coach"}
          </button>
        )}
        {/* Only show View Ride for actual ride sessions */}
        {linkedRideId && effectiveType === "ride" && (
          <a href={`/rides/${linkedRideId}`} className="btn-ghost text-xs"
             style={{ padding: "5px 10px" }}>
            View ride →
          </a>
        )}
      </div>

      {showSwap && (
        <div className="mt-2 p-2 rounded-lg" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <div className="text-xs text-[var(--muted)] mb-2">Replace this session with…</div>
          <div className="flex flex-wrap gap-2">
            {SWAPPABLE_TYPES.map((t) => (
              <button key={t} onClick={() => swapType(t === session.type ? null : t)} disabled={busy}
                className={effectiveType === t ? "btn-primary" : "btn-ghost"}
                style={{ padding: "5px 10px", fontSize: 12 }}>
                {sessionLabel(t)}
              </button>
            ))}
            {swappedTo && (
              <button onClick={() => swapType(null)} disabled={busy} className="btn-ghost"
                style={{ padding: "5px 10px", fontSize: 12 }}>
                Restore original ({sessionLabel(session.type)})
              </button>
            )}
          </div>
        </div>
      )}

      {aiOpen && aiWorkout && (
        <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Coach-generated workout</span>
            <button onClick={() => setAiOpen(false)} className="text-[var(--muted)] hover:text-[var(--text)] text-sm">Hide</button>
          </div>
          <div className="text-sm whitespace-pre-wrap text-[var(--text)]">{aiWorkout}</div>
          <button onClick={generateWorkout} disabled={aiBusy} className="btn-ghost text-xs mt-2" style={{ padding: "4px 10px" }}>
            🔄 Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
