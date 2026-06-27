"use client";

// Self-rated MTB skills. Pick up to 4 focus areas — those bias your plan.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILLS } from "@/lib/training-content";

export default function SkillsForm({ userId, ratings, focusSkills }) {
  const router = useRouter();
  const supabase = createClient();

  // ratings: array of {key, rating} from the `skills` table.
  const initial = {};
  for (const s of SKILLS) {
    initial[s.key] = ratings?.find((r) => r.key === s.key)?.rating ?? 5;
  }
  const [values, setValues] = useState(initial);
  const [focus, setFocus] = useState(focusSkills || []);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  async function setRating(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function toggleFocus(key) {
    if (focus.includes(key)) {
      setFocus(focus.filter((k) => k !== key));
    } else if (focus.length < 4) {
      setFocus([...focus, key]);
    } else {
      alert("Max 4 focus skills. Remove one first.");
    }
  }

  async function handleSave() {
    setBusy(true); setSuccess("");

    // Upsert ratings row-by-row (8 rows).
    const rows = SKILLS.map((s) => ({ user_id: userId, key: s.key, rating: values[s.key] }));
    const { error: r1 } = await supabase.from("skills").upsert(rows, { onConflict: "user_id,key" });

    // Save focus list on profile.
    const { error: r2 } = await supabase.from("profiles").update({ focus_skills: focus }).eq("id", userId);

    setBusy(false);
    if (r1 || r2) { alert("Save failed: " + (r1?.message || r2?.message)); return; }
    setSuccess("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {SKILLS.map((skill) => {
        const v = values[skill.key];
        const isFocused = focus.includes(skill.key);
        const tier = v <= 3 ? "Novice" : v <= 6 ? "Intermediate" : v <= 8 ? "Advanced" : "Pro";
        // Map rating to a fill % so the bar visually mirrors the slider position.
        const pct = ((v - 1) / 9) * 100;
        return (
          <div
            key={skill.key}
            className={isFocused ? "skill-card card-glass skill-card--focused" : "skill-card card-glass"}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <div>
                <div className="font-bold">{skill.label}</div>
                <div className="text-xs text-[var(--muted)]">{skill.desc}</div>
              </div>
              <button
                onClick={() => toggleFocus(skill.key)}
                className={isFocused ? "btn-primary text-xs" : "btn-ghost text-xs"}
                style={{ padding: "5px 10px" }}
              >
                {isFocused ? "Focused ★" : "Focus"}
              </button>
            </div>

            {/* Glassy track behind the slider so the level reads at a glance. */}
            <div className="skill-track">
              <div className="skill-track-fill" style={{ width: `${pct}%` }} />
              <input
                type="range" min={1} max={10} value={v}
                onChange={(e) => setRating(skill.key, +e.target.value)}
                className="skill-range"
                aria-label={`${skill.label} rating`}
              />
            </div>

            <div className="flex justify-between text-xs mt-1">
              <span className="text-[var(--muted)]">Level {v} / 10</span>
              <span className="text-[var(--muted)]">{tier}</span>
            </div>
          </div>
        );
      })}

      <div className="card-glass flex items-center justify-between">
        <div className="text-sm">
          <strong>{focus.length}</strong> / 4 focus skills selected
        </div>
        <div className="flex items-center gap-3">
          {success && <span className="text-[var(--green)] text-sm">✓ {success}</span>}
          <button onClick={handleSave} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
