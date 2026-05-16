"use client";

// Profile form: rider preset, level, weekly hours, intensity, plan length, goal, race date.
// Saves to the `profiles` table (row created automatically on signup).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Picking a preset auto-fills weekly hours + intensity to sensible defaults.
const PRESETS = {
  Novice: { weekly_hours: 4,  intensity: "easier"   },
  Sport:  { weekly_hours: 7,  intensity: "standard" },
  Pro:    { weekly_hours: 12, intensity: "harder"   },
};

export default function ProfileForm({ userId, profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName]                 = useState(profile?.name ?? "");
  const [preset, setPreset]             = useState(profile?.preset ?? "Sport");
  const [level, setLevel]               = useState(profile?.level ?? "Intermediate");
  const [weeklyHours, setWeeklyHours]   = useState(profile?.weekly_hours ?? 6);
  const [intensity, setIntensity]       = useState(profile?.intensity ?? "standard");
  const [planWeeks, setPlanWeeks]       = useState(profile?.plan_weeks ?? 12);
  const [goal, setGoal]                 = useState(profile?.goal ?? "Race fitness");
  const [raceDate, setRaceDate]         = useState(profile?.race_date ?? "");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");

  function handlePresetChange(newPreset) {
    setPreset(newPreset);
    const p = PRESETS[newPreset];
    if (p) {
      setWeeklyHours(p.weekly_hours);
      setIntensity(p.intensity);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");

    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        preset,
        level,
        weekly_hours: weeklyHours,
        intensity,
        plan_weeks: planWeeks,
        goal,
        race_date: raceDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="card">
      <h2 className="text-lg font-bold mb-1">Rider profile</h2>
      <p className="text-sm text-[var(--muted)] mb-5">
        Drives your plan: hours, intensity, focus.
      </p>

      <div className="mb-4">
        <label className="field-label">Your name</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="input" placeholder="Pete"
        />
      </div>

      <div className="mb-4">
        <label className="field-label">Rider preset</label>
        <div className="grid grid-cols-3 gap-2">
          {["Novice", "Sport", "Pro"].map((p) => (
            <button
              key={p} type="button"
              onClick={() => handlePresetChange(p)}
              className={preset === p ? "btn-primary" : "btn-ghost"}
              style={{ justifyContent: "center" }}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Picking a preset sets sensible defaults for weekly hours + intensity. You can override below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="field-label">Skill level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="input">
            {["Beginner","Intermediate","Advanced","Expert"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Weekly training hours</label>
          <input
            type="number" min={3} max={20} value={weeklyHours}
            onChange={(e) => setWeeklyHours(+e.target.value)} className="input"
          />
        </div>

        <div>
          <label className="field-label">Default intensity</label>
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)} className="input">
            {["easier","standard","harder"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Plan length</label>
          <select value={planWeeks} onChange={(e) => setPlanWeeks(+e.target.value)} className="input">
            {[6, 8, 12, 16, 24].map((n) => (
              <option key={n} value={n}>{n} weeks</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="field-label">Primary goal</label>
        <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input">
          {[
            "Race fitness",
            "Trail-ready endurance",
            "Get faster on local trails",
            "Recover from injury",
            "Just have fun",
          ].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="field-label">Race or target event date (optional)</label>
        <input
          type="date" value={raceDate || ""}
          onChange={(e) => setRaceDate(e.target.value)} className="input"
        />
      </div>

      {error && <p className="text-[#e87262] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[#6cc28a] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
