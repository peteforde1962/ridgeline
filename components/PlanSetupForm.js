"use client";

// Plan setup: preset, weekly hours, intensity, plan length, goal, race date.
// Also has a "Reset plan" button that clears every plan_sessions + plan_day_notes
// row for this user and sets started_at = null, so /plan reverts to the
// "no active plan" CTA.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";

const PRESETS = {
  Novice: { weekly_hours: 4,  intensity: "easier"   },
  Sport:  { weekly_hours: 7,  intensity: "standard" },
  Pro:    { weekly_hours: 12, intensity: "harder"   },
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Day-of-week buttons. Indices match our Monday-anchored calendar
// (0 = Mon … 6 = Sun) so they line up with dateForDay / DAY_NAMES.
const DOW = [
  { idx: 0, label: "Mon" }, { idx: 1, label: "Tue" }, { idx: 2, label: "Wed" },
  { idx: 3, label: "Thu" }, { idx: 4, label: "Fri" }, { idx: 5, label: "Sat" },
  { idx: 6, label: "Sun" },
];

export default function PlanSetupForm({ userId, profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [preset, setPreset]           = useState(profile?.preset ?? "Sport");
  const [weeklyHours, setWeeklyHours] = useState(profile?.weekly_hours ?? 6);
  const [intensity, setIntensity]     = useState(profile?.intensity ?? "standard");
  const [planWeeks, setPlanWeeks]     = useState(profile?.plan_weeks ?? 12);
  const [goal, setGoal]               = useState(profile?.goal ?? "Race fitness");
  const [raceDate, setRaceDate]       = useState(profile?.race_date ?? "");
  const [startedAt, setStartedAt]     = useState(profile?.started_at ?? todayISO());
  // Default to all 7 days if the profile hasn't specified (legacy rows).
  const [workoutDays, setWorkoutDays] = useState(
    Array.isArray(profile?.workout_days) && profile.workout_days.length > 0
      ? profile.workout_days
      : [0,1,2,3,4,5,6]
  );

  // Which activity types are included in this rider's plan. Empty array means
  // "everything" for backward compat, but the UI initializes to the full set.
  const [enabledActivities, setEnabledActivities] = useState(
    Array.isArray(profile?.enabled_activities) && profile.enabled_activities.length > 0
      ? profile.enabled_activities
      : ["ride", "strength", "yoga", "run", "rope"]
  );
  const [bodyFocus, setBodyFocus] = useState(
    Array.isArray(profile?.body_focus) && profile.body_focus.length > 0
      ? profile.body_focus
      : ["legs", "core", "upper", "posterior"]
  );
  const [trainingFocus, setTrainingFocus] = useState(
    Array.isArray(profile?.training_focus) ? profile.training_focus : []
  );

  function toggleDay(idx) {
    setWorkoutDays((cur) =>
      cur.includes(idx) ? cur.filter((d) => d !== idx) : [...cur, idx].sort((a,b) => a-b)
    );
  }
  function toggleInArray(setter) {
    return (val) => setter((cur) =>
      cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]
    );
  }
  const toggleActivity = toggleInArray(setEnabledActivities);
  const toggleBody     = toggleInArray(setBodyFocus);
  const toggleFocus    = toggleInArray(setTrainingFocus);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");

  const planActive = !!profile?.started_at;

  function applyPreset(p) {
    setPreset(p);
    const def = PRESETS[p];
    if (def) { setWeeklyHours(def.weekly_hours); setIntensity(def.intensity); }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");

    const newStartedAt = startedAt || todayISO();
    const startedAtChanged =
      profile?.started_at && profile.started_at !== newStartedAt;

    // Warn before shifting start date — old plan_sessions are keyed by
    // (week_index, day_index), and those indices will now map to different
    // calendar dates. Leaving them in place makes the new plan look like
    // sessions are already ticked done. Cleanest fix: wipe them.
    if (startedAtChanged) {
      const ok = confirm(
        `Change plan start date from ${profile.started_at} to ${newStartedAt}?\n\n` +
        "This will clear your existing plan history (completions, swaps, extras, notes) " +
        "because the old data was keyed to the old start date. Your rides and profile stay untouched."
      );
      if (!ok) { setSaving(false); return; }
    }

    const patch = {
      preset, weekly_hours: weeklyHours, intensity,
      plan_weeks: planWeeks, goal, race_date: raceDate || null,
      workout_days: workoutDays.length > 0 ? workoutDays : [0,1,2,3,4,5,6],
      // Save at least one activity even if the user unchecked everything.
      enabled_activities: enabledActivities.length > 0
        ? enabledActivities
        : ["ride", "strength", "yoga", "run", "rope"],
      body_focus:     bodyFocus,
      training_focus: trainingFocus,
      started_at: newStartedAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) { setSaving(false); setError(error.message); return; }

    // Wipe stale plan state so it can't leak into the shifted date grid.
    if (startedAtChanged) {
      await supabase.from("plan_sessions").delete().eq("user_id", userId);
      await supabase.from("plan_day_notes").delete().eq("user_id", userId);
    }

    setSaving(false);
    setSuccess(planActive ? "Plan settings saved." : "Plan started!");
    router.refresh();
  }

  async function resetPlan() {
    if (!confirm(
      "Delete your current plan and start over?\n\n" +
      "This permanently removes:\n" +
      "  • Every workout you've marked done, skipped, swapped, or added\n" +
      "  • Every day note\n\n" +
      "Your profile, rides, trails, and coach link are NOT affected. You'll get a fresh blank plan to set up again."
    )) return;
    setResetting(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/plan/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed"); setResetting(false); return; }
      setSuccess(`Plan reset — ${data.sessions_deleted} sessions and ${data.notes_deleted} notes cleared.`);
      router.refresh();
    } catch (e) { setError(e.message); }
    setResetting(false);
  }

  return (
    <form onSubmit={save} className="card">
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-lg font-bold">Training plan</h2>
        {planActive && (
          <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide"
                style={{ background: "var(--accent)", color: "#1a2a30" }}>
            Active
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--muted)] mb-5">
        {planActive
          ? <>Tunes how your plan is built. Changes take effect on the next page load. Plan started <strong>{profile.started_at}</strong>.</>
          : <>You don't have an active plan. Choose your settings, click <strong>Start plan</strong> below, and we'll begin today.</>}
      </p>

      <div className="mb-4">
        <label className="field-label">Rider preset</label>
        <div className="grid grid-cols-3 gap-2">
          {["Novice", "Sport", "Pro"].map((p) => (
            <button key={p} type="button" onClick={() => applyPreset(p)}
                    className={preset === p ? "btn-primary" : "btn-ghost"}
                    style={{ justifyContent: "center" }}>
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Sets sensible defaults for hours + intensity. Override below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="field-label">Weekly training hours</label>
          <input type="number" min={3} max={20} value={weeklyHours}
                 onChange={(e) => setWeeklyHours(+e.target.value)} className="input" />
        </div>
        <div>
          <label className="field-label">Default intensity</label>
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)} className="input">
            {["easier","standard","harder"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Plan length</label>
          <select value={planWeeks} onChange={(e) => setPlanWeeks(+e.target.value)} className="input">
            {[6, 8, 12, 16, 24].map((n) => <option key={n} value={n}>{n} weeks</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Plan start date</label>
          <input type="date" value={startedAt || ""}
                 onChange={(e) => setStartedAt(e.target.value)}
                 className="input" required />
          <p className="text-[10px] text-[var(--muted)] mt-1">
            Can be midweek — the plan still anchors to the Monday of the week containing this date.
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Race or event date (optional)</label>
          <input type="date" value={raceDate || ""} onChange={(e) => setRaceDate(e.target.value)} className="input" />
        </div>
      </div>

      <div className="mb-5">
        <label className="field-label">Primary goal</label>
        <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input">
          {[
            "Race fitness",
            "Trail-ready endurance",
            "Get faster on local trails",
            "Lose weight",
            "Recover from injury",
            "Just have fun",
          ].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="mb-5">
        <label className="field-label">Workout days</label>
        <div className="grid grid-cols-7 gap-1.5">
          {DOW.map(({ idx, label }) => {
            const on = workoutDays.includes(idx);
            return (
              <button key={idx} type="button" onClick={() => toggleDay(idx)}
                className="rounded-lg font-semibold transition-colors text-xs"
                style={{
                  padding: "10px 0",
                  background: on
                    ? "linear-gradient(135deg, var(--accent), var(--accent2,#fccabb))"
                    : "var(--panel)",
                  color: on ? "#1a2a30" : "var(--muted)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                  cursor: "pointer",
                }}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Selected days will have workouts scheduled. Unselected days become rest days.
          {workoutDays.length === 0 && <span className="text-[var(--red,#e87262)]"> (Pick at least one day or your plan will be all rest!)</span>}
        </p>
      </div>

      {/* --- Activities to include in the plan --- */}
      <div className="mb-6 pt-4" style={{ borderTop: "1px dashed var(--line)" }}>
        <label className="field-label">Include which activities?</label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "ride",     label: "Riding" },
            { key: "strength", label: "Strength" },
            { key: "yoga",     label: "Yoga & Mobility" },
            { key: "run",      label: "Running" },
            { key: "rope",     label: "Flow Rope" },
          ].map(({ key, label }) => {
            const on = enabledActivities.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggleActivity(key)}
                className={on ? "btn-primary text-sm" : "btn-ghost text-sm"}
                style={{ padding: "8px 14px" }}>
                {on && "✓ "}{label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Uncheck anything you don't want in your plan (e.g. no flow rope, or riding-only).
          Days that had ONLY unchecked activities become rest days.
          {enabledActivities.length === 0 && <span className="text-[var(--red,#e87262)]"> (Pick at least one activity!)</span>}
        </p>
      </div>

      {/* --- Body regions to emphasize (weights strength content) --- */}
      <div className="mb-6">
        <label className="field-label">Emphasize which body regions?</label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "legs",       label: "Legs" },
            { key: "core",       label: "Core" },
            { key: "upper",      label: "Upper body" },
            { key: "posterior",  label: "Posterior chain" },
            { key: "mobility",   label: "Mobility" },
          ].map(({ key, label }) => {
            const on = bodyFocus.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggleBody(key)}
                className={on ? "btn-primary text-sm" : "btn-ghost text-sm"}
                style={{ padding: "8px 14px" }}>
                {on && "✓ "}{label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Coach AI biases strength workouts toward these areas.
        </p>
      </div>

      {/* --- MTB skill focus (weights ride content + skills suggestions) --- */}
      <div className="mb-6">
        <label className="field-label">MTB skill focus <span className="text-[var(--muted)] font-normal">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "climbing",    label: "Climbing" },
            { key: "descending",  label: "Descending" },
            { key: "endurance",   label: "Endurance" },
            { key: "power",       label: "Power / sprints" },
            { key: "technical",   label: "Technical skills" },
            { key: "race",        label: "Race prep" },
          ].map(({ key, label }) => {
            const on = trainingFocus.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggleFocus(key)}
                className={on ? "btn-primary text-sm" : "btn-ghost text-sm"}
                style={{ padding: "8px 14px" }}>
                {on && "✓ "}{label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Coach AI biases ride content + skill sessions toward these focuses.
        </p>
      </div>

      {error && <p className="text-[var(--red,#e87262)] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[var(--green,#5cb85c)] text-sm mb-3">✓ {success}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : planActive ? "Save plan settings" : "Start plan"}
        </button>
        {planActive && (
          <button type="button" onClick={resetPlan} disabled={resetting}
                  className="btn-ghost inline-flex items-center gap-1.5"
                  style={{ color: "var(--red,#e87262)" }}>
            <Icon name="trash" size={13} />
            {resetting ? "Resetting…" : "Reset plan"}
          </button>
        )}
      </div>
    </form>
  );
}
