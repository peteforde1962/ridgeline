"use client";

// Student-side: enter your coach's invite code to link.
// If already linked, show the coach + "Disconnect" option.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StudentCoachCard({ profile, coach }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function link(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    const clean = code.trim().toUpperCase();
    // Look up coach by code via API (RLS would block direct lookup).
    const res = await fetch("/api/coach-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: clean }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed to link"); return; }
    setCode("");
    router.refresh();
  }

  async function unlink() {
    if (!confirm("Disconnect from your coach? They'll lose access to your data.")) return;
    await supabase.from("profiles").update({ coach_id: null }).eq("id", profile.id);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Your coach</h2>
      {coach ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold">{coach.name || coach.email}</div>
            <div className="text-xs text-[var(--muted)]">Has access to your plan, rides, check-ins, videos.</div>
          </div>
          <button onClick={unlink} className="btn-ghost text-sm">Disconnect</button>
        </div>
      ) : (
        <form onSubmit={link}>
          <p className="text-sm text-[var(--muted)] mb-3">
            Got a coach? Paste their 6-character invite code to connect.
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="input"
              style={{ letterSpacing: "0.2em", fontFamily: "monospace", maxWidth: 200 }}
            />
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary">
              {busy ? "Linking…" : "Link"}
            </button>
          </div>
          {error && <p className="text-[var(--red,#e87262)] text-sm mt-2">⚠ {error}</p>}
        </form>
      )}
    </div>
  );
}
