"use client";

// Add an "extra" workout to a day (beyond the template).
// E.g. user adds a BJJ class, a swim, an extra strength session, etc.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sessionLabel } from "@/lib/plan";

const TYPES = ["ride", "strength", "yoga", "run", "rope", "rest"];

export default function AddExtraSessionForm({ userId, weekIndex, dayIndex, nextSessionIdx }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("strength");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState("");   // duration in minutes; blank = no target
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError("");

    // Parse minutes — accept empty as null so the user isn't forced to set one.
    const parsedMinutes = minutes === "" ? null : Math.max(1, Math.round(+minutes));

    const { error: err } = await supabase.from("plan_sessions").insert({
      user_id: userId,
      week_index: weekIndex,
      day_index: dayIndex,
      session_idx: nextSessionIdx,
      is_extra: true,
      swapped_to: type,
      custom_name: name.trim() || null,
      custom_notes: notes.trim() || null,
      planned_minutes: parsedMinutes,
      completed: false,
      tweak: "standard",
    });

    setBusy(false);
    if (err) { setError(err.message); return; }

    setOpen(false);
    setName(""); setNotes(""); setMinutes(""); setType("strength");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
        + Add a workout to this day
      </button>
    );
  }

  return (
    <form onSubmit={save} className="card mb-3" style={{ background: "var(--panel2)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Add a workout</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="field-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map((t) => <option key={t} value={t}>{sessionLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input"
                 placeholder="BJJ class, swim, climbing, ..." />
        </div>
        <div>
          <label className="field-label">Duration (min)</label>
          <input
            type="number" min={1} step={1}
            value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="input"
            placeholder="e.g. 45"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="field-label">Details / instructions</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input"
                  placeholder="Anything to remember about this session…" />
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-sm">
          {busy ? "Saving…" : "Add workout"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
      </div>
    </form>
  );
}
