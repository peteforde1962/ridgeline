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

// Generic name + notes when a session is swapped to a different type — replaces
// the template's original description (e.g. swap a run for yoga and you no longer
// see "30-40 min easy aerobic run").
const SWAP_DEFAULTS = {
  ride:     { name: "Ride session",          notes: "Pick a route. Use today's intensity to guide effort." },
  strength: { name: "Strength session",       notes: "Open the Strength library for a workout — or generate one with Coach." },
  yoga:     { name: "Yoga / mobility session", notes: "Open the Yoga library for a flow — or generate one with Coach." },
  run:      { name: "Run session",            notes: "Open the Running library for session ideas." },
  rope:     { name: "Flow rope session",      notes: "Open the Flow Rope library for drills." },
  rest:     { name: "Rest day",               notes: "Walk, hydrate, sleep. Adaptation happens now." },
};

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
  // When swapped, replace the original name/notes with a generic default for the new type.
  const effectiveSession = swappedTo
    ? { type: swappedTo, ...SWAP_DEFAULTS[swappedTo] }
    : session;
  const linkedRideId = stored?.ride_id;
  const linkedRide   = stored?.linkedRide;

  // If the session is linked to an actual ride, prefer the ride's title for display.
  // Falls back to the swap default / template name otherwise.
  const rideTitle = linkedRide?.notes ? linkedRide.notes.split(" · ")[0] : null;
  const displayName =
    rideTitle ? rideTitle :
    isSkipped ? `(skipped) ${effectiveSession.name}` :
    scaleSessionName(effectiveSession.name, tweak);
  // Keep the plan reference visible if we substituted a ride title.
  const plannedSub = rideTitle ? `Planned: ${effectiveSession.name}` : null;

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

  const [workoutSource, setWorkoutSource] = useState(stored?.ai_workout ? "cached" : null);

  // showWorkout: default load — pulls from the library (instant, on-brand) or returns cached.
  // regenerate=true forces a fresh AI call with a type-strict prompt.
  async function showWorkout({ regenerate = false } = {}) {
    setAiBusy(true); setAiOpen(true);
    try {
      const res = await fetch("/api/plan/workout-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekIndex, dayIndex, sessionIdx,
          sessionType: effectiveType,
          sessionName: session.name,
          phaseName: session.phase,
          regenerate,
        }),
      });
      const data = await res.json();
      if (data.workout) {
        setAiWorkout(data.workout);
        setWorkoutSource(data.source);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) { alert("Failed: " + e.message); }
    setAiBusy(false);
  }

  const status = completed ? "done" : isSkipped ? "skipped" : "pending";
  const statusIcon = status === "done" ? "✓" : status === "skipped" ? "✗" : "○";
  const statusColor = status === "done" ? "#5cb85c" : status === "skipped" ? "#d9534f" : "var(--muted)";

  const prescribed = !!stored?.prescribed_by_coach_id;

  return (
    <div className="card mb-3" style={{
      opacity: isSkipped ? 0.7 : 1,
      borderColor: prescribed ? "rgba(248,182,166,.55)" : undefined,
      borderWidth: prescribed ? 1.5 : undefined,
    }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(effectiveType)}`}>
            {sessionLabel(effectiveType)}{swappedTo && <span className="text-[10px] ml-1 opacity-70">(swapped)</span>}
          </span>
          {prescribed && (
            <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide"
                  style={{ background: "var(--accent)", color: "#1a2a30" }}>
              From your coach
            </span>
          )}
          <h3 className="font-bold text-base">
            <span style={{ color: statusColor, marginRight: 6, fontWeight: 900 }}>{statusIcon}</span>
            {displayName}
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

      {plannedSub && <p className="text-xs text-[var(--muted)] mb-1">{plannedSub}</p>}
      {linkedRide && (
        <p className="text-sm text-[var(--muted)] mb-3">
          {linkedRide.km}km · {linkedRide.minutes}min · {linkedRide.elev_m || 0}m climb
        </p>
      )}
      {!linkedRide && effectiveSession.notes && (
        <p className="text-sm text-[var(--muted)] mb-3">{effectiveSession.notes}</p>
      )}

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
        {/* Workout details button — auto-populates from the library by default */}
        {effectiveType !== "rest" && (
          <button onClick={() => showWorkout()} disabled={aiBusy} className="btn-ghost text-xs ml-auto"
            style={{ padding: "5px 10px" }}>
            {aiBusy ? "Loading…" : aiWorkout ? "Show workout" : "Show workout"}
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
        <div className="mt-3 p-4 rounded-lg" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {workoutSource === "ai" || workoutSource === "ai-regenerate"
                ? "Coach-generated workout"
                : "Workout"}
            </span>
            <button onClick={() => setAiOpen(false)} className="text-[var(--muted)] hover:text-[var(--text)] text-sm">Hide</button>
          </div>
          <WorkoutMarkdown text={aiWorkout} />
          <button onClick={() => showWorkout({ regenerate: true })} disabled={aiBusy}
                  className="btn-ghost text-xs mt-3" style={{ padding: "4px 10px" }}>
            {aiBusy ? "Regenerating…" : "🤖 Regenerate with Coach AI"}
          </button>
        </div>
      )}
    </div>
  );
}

// Tiny inline markdown renderer — handles headings, **bold**, _italic_, bullets,
// and [link](url). Keeps the workout panel on-brand without an extra library.
function WorkoutMarkdown({ text }) {
  const lines = (text || "").split("\n");
  const elements = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line) { elements.push(<div key={i} className="h-2" />); return; }
    if (line.startsWith("# ")) {
      elements.push(<h4 key={i} className="text-base font-bold text-[var(--text)] mt-1 mb-1">{inline(line.slice(2))}</h4>);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(<div key={i} className="text-xs font-bold uppercase tracking-wide text-[var(--accent2,#fccabb)] mt-2 mb-1">{line.slice(2, -2)}</div>);
    } else if (line.startsWith("• ") || line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-[var(--text)]">
          <span className="text-[var(--accent)]">•</span>
          <span className="flex-1">{inline(line.slice(2))}</span>
        </div>
      );
    } else {
      elements.push(<p key={i} className="text-sm text-[var(--text)]">{inline(line)}</p>);
    }
  });
  return <div className="space-y-0.5">{elements}</div>;

  function inline(s) {
    // Handle **bold**, _italic_, and [text](url) — naive but safe for our markdown.
    const parts = [];
    let i = 0, key = 0;
    const push = (chunk) => { if (chunk) parts.push(<span key={key++}>{chunk}</span>); };
    while (i < s.length) {
      // [text](url)
      if (s[i] === "[") {
        const close = s.indexOf("](", i);
        const end = close > 0 ? s.indexOf(")", close) : -1;
        if (close > 0 && end > 0) {
          const text = s.slice(i + 1, close);
          const url  = s.slice(close + 2, end);
          parts.push(<a key={key++} href={url} className="text-[var(--accent)] font-semibold">{text}</a>);
          i = end + 1; continue;
        }
      }
      // **bold**
      if (s[i] === "*" && s[i + 1] === "*") {
        const close = s.indexOf("**", i + 2);
        if (close > 0) {
          parts.push(<strong key={key++} className="text-[var(--text)] font-bold">{s.slice(i + 2, close)}</strong>);
          i = close + 2; continue;
        }
      }
      // _italic_
      if (s[i] === "_") {
        const close = s.indexOf("_", i + 1);
        if (close > 0) {
          parts.push(<em key={key++} className="text-[var(--muted)] italic">{s.slice(i + 1, close)}</em>);
          i = close + 1; continue;
        }
      }
      // Plain run — find next special
      let next = s.length;
      for (const ch of ["[", "*", "_"]) {
        const idx = s.indexOf(ch, i);
        if (idx >= 0 && idx < next) next = idx;
      }
      push(s.slice(i, next));
      i = next;
    }
    return parts;
  }
}
