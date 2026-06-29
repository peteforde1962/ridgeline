"use client";

// Body check-in form. Lives inside /checkin.
// Saves a single row per user per day to the `check_ins` table.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CheckinForm({ userId, todayCheckin, today }) {
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

    // Use the date the server computed in the user's IANA timezone. Falls
    // back to UTC only if the parent didn't pass one (legacy callers).
    const dateKey = today || new Date().toISOString().slice(0, 10);

    // upsert = insert or update the row keyed by (user_id, date).
    const { error } = await supabase
      .from("check_ins")
      .upsert(
        { user_id: userId, date: dateKey, sleep, soreness, energy, notes },
        { onConflict: "user_id,date" }
      );

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess("Saved.");
    router.refresh(); // re-render the page so history updates
  }

  // Each slider's fill percentage so the glassy track behind shows the value.
  const pct = (v) => ((v - 1) / 9) * 100;

  // Tiny reusable render for the three readiness sliders so the markup stays
  // tidy. Reuses the .skill-track / .skill-range styles from the Skills page.
  function GlassSlider({ label, hint, value, onChange }) {
    return (
      <div className="mb-4">
        <label className="field-label">
          {label} — <span className="text-[var(--text)] font-semibold">{value}</span>
          <span className="text-xs ml-2">{hint}</span>
        </label>
        <div className="skill-track">
          <div className="skill-track-fill" style={{ width: `${pct(value)}%` }} />
          <input
            type="range" min={1} max={10} value={value}
            onChange={(e) => onChange(+e.target.value)}
            className="skill-range"
            aria-label={label}
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="card-glass">
      <h2 className="text-lg font-bold mb-1">How are you feeling today?</h2>
      <p className="text-sm text-[var(--muted)] mb-5">
        30-second check-in. Tunes today's training intensity.
      </p>

      <GlassSlider label="Sleep quality" hint="(1 awful → 10 great)"
                   value={sleep}    onChange={setSleep} />
      <GlassSlider label="Soreness"      hint="(1 fresh → 10 wrecked)"
                   value={soreness} onChange={setSoreness} />
      <GlassSlider label="Energy"        hint="(1 flat → 10 fired up)"
                   value={energy}   onChange={setEnergy} />

      <div className="mb-5">
        <label className="field-label">Notes (optional)</label>
        <textarea
          rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
          className="input" placeholder="Slept poorly, knee a bit cranky from yesterday's ride…"
        />
      </div>

      <div
        className="rounded-lg p-3 mb-5 text-sm border backdrop-blur-sm"
        style={{
          background: signal.tone === "good"   ? "rgba(78,104,81,.18)"
                    : signal.tone === "warn"   ? "rgba(215,106,74,.18)"
                    :                            "rgba(242,104,56,.12)",
          borderColor: signal.tone === "good"  ? "rgba(78,104,81,.7)"
                     : signal.tone === "warn"  ? "rgba(215,106,74,.7)"
                     :                           "rgba(242,104,56,.55)",
        }}
      >
        <strong className="block mb-1">Readiness signal</strong>
        {signal.label}
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[var(--green)] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : todayCheckin ? "Update today's check-in" : "Save check-in"}
      </button>
    </form>
  );
}
