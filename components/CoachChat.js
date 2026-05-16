"use client";

// Coach AI chat. Multi-turn — keeps message history in component state.
// Calls /api/coach which talks to Anthropic server-side.

import { useState, useRef, useEffect } from "react";

const STARTER_PROMPTS = [
  "Build me a 2-week plan focused on technical descents",
  "I'm sore today — modify my workout",
  "I have a 50-mile race in 8 weeks — what should I prioritize?",
  "Suggest a 20-minute mobility routine for my low back",
  "How do I get faster cornering on loose dirt?",
  "Replace today's ride with an indoor option",
];

export default function CoachChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(""); // "anthropic" | "local-fallback"
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages([...next, { role: "assistant", content: "⚠ " + (data.error || "Coach error") }]);
      } else {
        setSource(data.source || "");
        setMessages([...next, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: "⚠ Network error: " + e.message }]);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">
            <strong>Coach AI</strong>
            <span className="text-[var(--muted)] ml-2 text-xs">
              {source === "local-fallback"
                ? "⚙️ Local fallback (set ANTHROPIC_API_KEY for real LLM)"
                : source === "anthropic"
                ? "🤖 Live (Claude Haiku)"
                : "Ready"}
            </span>
          </div>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setSource(""); }} className="btn-ghost text-xs">
              Clear
            </button>
          )}
        </div>

        <div
          ref={logRef}
          className="rounded-lg p-3 mb-3"
          style={{
            background: "var(--panel2,#1d2a23)",
            border: "1px solid var(--line)",
            minHeight: 240,
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          {messages.length === 0 ? (
            <p className="text-[var(--muted)] text-sm">
              Ask anything. Coach has your profile, recent check-ins, and recent rides as context.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className="mb-2 p-2 rounded-md text-sm"
                style={
                  m.role === "user"
                    ? { background: "rgba(255,122,41,.12)", border: "1px solid rgba(255,122,41,.35)", marginLeft: "10%" }
                    : { background: "var(--panel,#17221c)", border: "1px solid var(--line)", marginRight: "10%" }
                }
              >
                <div className="text-xs text-[var(--muted)] mb-1">{m.role === "user" ? "You" : "🤖 Coach"}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))
          )}
          {busy && (
            <div className="text-sm text-[var(--muted)] italic">Coach is thinking…</div>
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
          {STARTER_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} className="btn-ghost text-xs" disabled={busy}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
