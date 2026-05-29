"use client";

// Coach-side: shows your invite code so students can attach to you.
// If you don't have one yet, generates one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function rand6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function CoachInviteCard({ profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState(profile.coach_code || "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    // Best-effort: try a few times in case of collision.
    let attempt = 0;
    while (attempt < 5) {
      const next = rand6();
      const { error } = await supabase.from("profiles")
        .update({ coach_code: next, role: "coach" })
        .eq("id", profile.id);
      if (!error) {
        setCode(next);
        setBusy(false);
        router.refresh();
        return;
      }
      attempt++;
    }
    setBusy(false);
    alert("Couldn't generate a unique code. Try again.");
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Your coach invite code</h2>
      <p className="text-sm text-[var(--muted)] mb-3">
        Share this code with riders so they can attach to you as their coach.
        You'll see their plan, rides, check-ins, and videos in your <a href="/coaching" className="text-[var(--accent)] font-semibold">Coaching</a> area.
      </p>
      {code ? (
        <div className="flex items-center gap-3">
          <code className="text-2xl font-bold tracking-widest px-4 py-2 rounded"
                style={{ background: "var(--surface2,#1a3d3d)", color: "var(--accent2,#f4b860)" }}>
            {code}
          </code>
          <button onClick={copy} className="btn-ghost text-sm">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      ) : (
        <button onClick={generate} disabled={busy} className="btn-primary">
          {busy ? "Generating…" : "Generate my code"}
        </button>
      )}
    </div>
  );
}
