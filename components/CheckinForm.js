"use client";

// Body check-in form. Lives inside /checkin.
// Saves a single row per user per day to the `check_ins` table.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CheckinForm({ userId, todayCheckin }) {
  const router = useRouter();
  const supabase = createClient();

  // Pre-fill with today's check-in if one already exists, else sensible defaults.
  const [sleep, setSleep] = useState(todayCheckin?.sleep ?? 7);
  const [soreness, setSoreness] = useState(todayCheckin?.soreness ?? 3);
  const [energy, setEnergy] = useState(todayCheckin?.energy ?? 6);
  const [notes, setNotes] = useState(todayCheckin?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Readiness math: high sleep + energy, low soreness = good day.
  const readiness = sleep + energy - soreness;
  const signal =
    readiness <= 3 ? { label: "Low readiness — Coach suggests Easier today", tone: "warn" } :
    readiness >= 8 ? { label: "Feeling great — push to Harder if motivated", tone: "good" } :
                     { label: "Stay on Standard. Build the habit.",          tone: "neutral" };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");

    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // upsert = insert or update the row keyed by (user_id, date).
    const { error } = await supabase
      .from("check_ins")
      .upsert(
        { user_id: userId, date: today, sleep, soreness, energy, notes },
        { onConflict: "user_id,date" }
      );

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess("Saved.");
    router.refresh(); // re-render the page so history updates
  }

  return (
    <form onSubmit={handleSave} className="card">
      <h2 className="text-lg font-bold mb-1">How are you feeling today?</h2>
      <p className="text-sm text-[var(--muted)] mb-5">
        30-second check-in. Tunes today's training intensity.
      </p>

      <div className="mb-4">
        <label className="field-label">
          Sleep quality — <span className="text-[var(--text)] font-semibold">{sleep}</span>
          <span className="text-xs ml-2">(1 awful → 10 great)</span>
        </label>
        <input
          type="range" min={1} max={10} value={sleep}
          onChange={(e) => setSleep(+e.target.value)}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="mb-4">
        <label className="field-label">
          Soreness — <span className="text-[var(--text)] font-semibold">{soreness}</span>
          <span className="text-xs ml-2">(1 fresh → 10 wrecked)</span>
        </label>
        <input
          type="range" min={1} max={10} value={soreness}
          onChange={(e) => setSoreness(+e.target.value)}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="mb-4">
        <label className="field-label">
          Energy — <span className="text-[var(--text)] font-semibold">{energy}</span>
          <span className="text-xs ml-2">(1 flat → 10 fired up)</span>
        </label>
        <input
          type="range" min={1} max={10} value={energy}
          onChange={(e) => setEnergy(+e.target.value)}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="mb-5">
        <label className="field-label">Notes (optional)</label>
        <textarea
          rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
          className="input" placeholder="Slept poorly, knee a bit cranky from yesterday's ride…"
        />
      </div>

      <div
        className="rounded-lg p-3 mb-5 text-sm border"
        style={{
          background: signal.tone === "good"   ? "rgba(108,194,138,.12)"
                    : signal.tone === "warn"   ? "rgba(232,114,98,.12)"
                    :                            "rgba(255,122,41,.10)",
          borderColor: signal.tone === "good"  ? "rgba(108,194,138,.5)"
                     : signal.tone === "warn"  ? "rgba(232,114,98,.5)"
                     :                           "rgba(255,122,41,.4)",
        }}
      >
        <strong className="block mb-1">Readiness signal</strong>
        {signal.label}
      </div>

      {error && <p className="text-[#e87262] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[#6cc28a] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : todayCheckin ? "Update today's check-in" : "Save check-in"}
      </button>
    </form>
  );
}
