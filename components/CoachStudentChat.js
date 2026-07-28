"use client";

// Coach ↔ Student chat — reusable component used on both sides.
// The coach embeds it inside /coaching/students/[id]; the student uses it
// full-page at /coach-chat. Same messages, keyed by (coachId, studentId).
//
// Polls the coach_messages table every 15 sec so new messages appear without
// a manual refresh. Marks the other party's unread messages as read when the
// component mounts / becomes visible.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";

const POLL_MS = 15000;

export default function CoachStudentChat({
  coachId, studentId, currentUserId, otherPartyName,
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const listEndRef              = useRef(null);

  const iAmCoach = currentUserId === coachId;

  async function loadMessages() {
    const { data, error } = await supabase
      .from("coach_messages")
      .select("id, sender_id, body, created_at, read_by_recipient_at")
      .eq("coach_id", coachId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });
    if (error) { setError(error.message); return; }
    setMessages(data || []);
    // Mark the other party's unread messages as read (fire-and-forget).
    const unread = (data || []).filter(
      (m) => m.sender_id !== currentUserId && !m.read_by_recipient_at
    );
    if (unread.length > 0) {
      supabase.from("coach_messages")
        .update({ read_by_recipient_at: new Date().toISOString() })
        .in("id", unread.map((m) => m.id))
        .then(() => {});
    }
  }

  // Initial load + polling.
  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, studentId]);

  // Auto-scroll to the latest message whenever the list changes.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true); setError("");
    const optimistic = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
      read_by_recipient_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    const { error } = await supabase.from("coach_messages").insert({
      coach_id:   coachId,
      student_id: studentId,
      sender_id:  currentUserId,
      body:       text,
    });
    setBusy(false);
    if (error) {
      // Roll back the optimistic message on failure so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setError(error.message);
      return;
    }
    // Refresh from server so our temp id gets replaced with the real one.
    loadMessages();
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="card-glass" style={{ display: "flex", flexDirection: "column", minHeight: 400, maxHeight: 620 }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="chat" size={18} stroke="var(--accent)" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
          Chat with {otherPartyName || (iAmCoach ? "student" : "coach")}
        </h2>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto pr-1 mb-3" style={{ minHeight: 240 }}>
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">
            No messages yet. Say hi.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <li
                  key={m.id}
                  className="flex"
                  style={{ justifyContent: mine ? "flex-end" : "flex-start" }}
                >
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{
                      maxWidth: "78%",
                      background: mine
                        ? "linear-gradient(135deg, var(--accent), var(--accent2,#fccabb))"
                        : "rgba(255,255,255,0.05)",
                      color: mine ? "#1a2a30" : "var(--text)",
                      border: mine ? "1px solid rgba(248,182,166,.6)" : "1px solid var(--line)",
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {m.body}
                    </div>
                    <div
                      className="text-[10px] mt-1"
                      style={{ opacity: 0.7, color: mine ? "#1a2a30" : "var(--muted)" }}
                    >
                      {fmtTime(m.created_at)}
                      {mine && m.read_by_recipient_at && " · read"}
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={listEndRef} />
          </ul>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter sends; plain Enter inserts newline.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(e);
          }}
          rows={2}
          className="input flex-1"
          placeholder={`Message ${otherPartyName || (iAmCoach ? "your student" : "your coach")}…`}
          style={{ resize: "vertical", minHeight: 42 }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="btn-primary inline-flex items-center gap-1.5"
          style={{ padding: "10px 16px" }}
        >
          <Icon name="send" size={14} stroke="#1a2a30" />
          Send
        </button>
      </form>
      {error && <p className="text-[var(--red,#e87262)] text-xs mt-2">⚠ {error}</p>}
      <p className="text-[10px] text-[var(--muted)] mt-2">
        Cmd/Ctrl+Enter to send. Updates every 15s.
      </p>
    </div>
  );
}
