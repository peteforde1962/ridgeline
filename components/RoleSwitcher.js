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

  async function setRole(next) {
    if (next === role) return;
    setBusy(true);
    const patch = { role: next };
    if (next === "coach" && !profile?.coach_code) patch.coach_code = rand6();
    if (next === "student") patch.coach_code = null;
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  return (
    <div className="card flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="font-bold">I am a…</div>
        <div className="text-xs text-[var(--muted)]">
          Coaches see all their students' data. Students can link to one coach.
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
  );
}
