"use client";

// Lets a user flip their role between student and coach.
// Coaches without a code get one auto-generated on switch.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function rand6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function RoleSwitcher({ profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const role = profile?.role || "student";
  const approved = !!profile?.coach_approved;
  const pending = role === "coach" && !approved;

  async function setRole(next) {
    if (next === role) return;
    setBusy(true);
    const patch = { role: next };
    if (next === "coach") {
      if (!profile?.coach_code) patch.coach_code = rand6();
      patch.coach_requested_at = new Date().toISOString();
      // coach_approved stays as-is — admin sets it true.
    }
    if (next === "student") {
      // Don't wipe coach_code in case they get re-approved later.
      patch.coach_approved = false;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="font-bold">I am a…</div>
          <div className="text-xs text-[var(--muted)]">
            Coaches see all their students' data. New coach requests require admin approval.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRole("student")}
            disabled={busy}
            className={role === "student" ? "btn-primary text-sm" : "btn-ghost text-sm"}
            style={{ padding: "8px 14px" }}
          >
            Student
          </button>
          <button
            onClick={() => setRole("coach")}
            disabled={busy}
            className={role === "coach" ? "btn-primary text-sm" : "btn-ghost text-sm"}
            style={{ padding: "8px 14px" }}
          >
            Coach
          </button>
        </div>
      </div>

      {pending && (
        <div className="text-sm rounded px-3 py-2"
             style={{ background: "rgba(244,184,96,.12)", border: "1px solid rgba(244,184,96,.4)" }}>
          ⏳ Your coach request is pending admin approval. Until approved, the Coaching area is locked.
        </div>
      )}
      {role === "coach" && approved && (
        <div className="text-xs text-[var(--muted)]">
          ✓ Coach approved. Manage your students in the <a href="/coaching" className="text-[var(--accent)] font-semibold">Coaching</a> area.
        </div>
      )}
    </div>
  );
}
