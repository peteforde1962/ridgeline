"use client";

// Coach AI chat — streams responses, lets user pick Haiku (fast) or Sonnet (smart).
// Suggestion chips adapt based on user state passed in from the server.

import { useState, useRef, useEffect } from "react";

export default function CoachChat({ context }) {
  // context: { hasCheckinToday, todayIsRest, raceWithinWeeks, hasNoRides, behindThisWeek, name }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("haiku"); // 'haiku' | 'sonnet'
  const [source, setSource] = useState("");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  // Build context-aware starter prompts.
  const starters = [];
  if (!context?.hasCheckinToday) starters.push("Should I train today? Help me think it through.");
  if (context?.todayIsRest)      starters.push("Should I move my long ride to today instead of resting?");
  if (context?.raceWithinWeeks && context.raceWithinWeeks <= 4)
    starters.push(`I have ${context.raceWithinWeeks} weeks until my event — what should I prioritize?`);
  if (context?.hasNoRides)       starters.push("Help me get the most out of my first 2 weeks on this plan.");
  if (context?.behindThisWeek)   starters.push("I'm falling behind this week — should I cut sessions or shift them?");
  // Always-good fallbacks
  starters.push("How do I get faster cornering on loose dirt?");
  starters.push("Suggest a 20-minute mobility routine for my low back.");
  starters.push("I'm sore today — modify my workout.");
  starters.push("Replace today's ride with an indoor option.");
  const visibleStarters = starters.slice(0, 6);

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    const next = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(0, -1).filter(m => m.content), model }),
      });

      setSource(res.headers.get("X-Coach-Source") || "");

      if (!res.ok) {
        let errMsg = "Coach error";
        try { const j = await res.json(); errMsg = j.error || errMsg; } catch {}
        replaceLast(next, "⚠ " + errMsg);
        setBusy(false);
        return;
      }

      // Streaming read
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        replaceLast(next, acc);
      }
    } catch (e) {
      replaceLast(next, "⚠ Network error: " + e.message);
    }
    setBusy(false);
  }

  function replaceLast(arr, content) {
    setMessages((cur) => {
      const updated = [...cur];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      return updated;
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="text-sm">
            <strong>Coach AI</strong>
            <span className="text-[var(--muted)] ml-2 text-xs">
              {source.startsWith("local-fallback")
                ? "⚙️ Local fallback"
                : source.startsWith("anthropic-sonnet")
                ? "🧠 Sonnet (deep)"
                : source.startsWith("anthropic-haiku")
                ? "⚡ Haiku (fast)"
                : "Ready"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted)]">Mode</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent border border-[var(--line)] rounded px-2 py-1 text-xs"
              disabled={busy}
            >
              <option value="haiku">⚡ Fast (Haiku)</option>
              <option value="sonnet">🧠 Deep (Sonnet)</option>
            </select>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setSource(""); }} className="btn-ghost text-xs" style={{ padding: "4px 8px" }}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div
          ref={logRef}
          className="rounded-lg p-3 mb-3"
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            minHeight: 260,
            maxHeight: "55vh",
            overflowY: "auto",
          }}
        >
          {messages.length === 0 ? (
            <p className="text-[var(--muted)] text-sm">
              Ask anything. Coach has your profile, recent check-ins, rides, current phase, and today's workout as context.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className="mb-2 p-2 rounded-md text-sm"
                style={
                  m.role === "user"
                    ? { background: "rgba(242,104,56,.12)", border: "1px solid rgba(242,104,56,.4)", marginLeft: "10%" }
                    : { background: "var(--panel)", border: "1px solid var(--line)", marginRight: "10%" }
                }
              >
                <div className="text-xs text-[var(--muted)] mb-1">{m.role === "user" ? "You" : "🤖 Coach"}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {m.content}
                  {busy && i === messages.length - 1 && m.role === "assistant" && (
                    <span className="inline-block w-2 h-4 ml-1 bg-[var(--accent)] animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask the coach…"
            className="input flex-1"
            disabled={busy}
          />
          <button onClick={() => send()} disabled={busy || !input.trim()} className="btn-primary">
            Send
          </button>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleStarters.map((p) => (
            <button key={p} onClick={() => send(p)} className="btn-ghost text-xs" disabled={busy} style={{ padding: "6px 12px" }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
