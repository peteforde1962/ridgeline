"use client";

// Coach-side: prescribe a workout for a student on a specific date.
// Library buttons seed the textarea so coaches don't have to write from scratch.
// On save: writes plan_sessions row + triggers email to student.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildWorkoutFromLibrary } from "@/lib/workout-builder";

const TYPES = [
  { id: "ride",     label: "Ride" },
  { id: "strength", label: "Strength" },
  { id: "yoga",     label: "Yoga / Mobility" },
  { id: "run",      label: "Run" },
  { id: "rope",     label: "Flow rope" },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function CoachPrescribeWorkout({ studentId, studentName }) {
  const router = useRouter();
  const [date, setDate]   = useState(todayStr());
  const [type, setType]   = useState("ride");
  const [name, setName]   = useState("");
  const [body, setBody]   = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");

  // Seed the textarea from the library.
  function loadFromLibrary() {
    const md = buildWorkoutFromLibrary({
      type, sessionName: name || `${type} session`,
      weekIndex: 0, dayIndex: 0, sessionIdx: 0,
    });
    if (md) setBody(md);
  }

  async function submit(e) {
    e.preventDefault();
    setError(""); setResult(null); setBusy(true);
    try {
      const res = await fetch("/api/coaching/prescribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId, date, type,
          name: name || `${type[0].toUpperCase() + type.slice(1)} session`,
          body, notifyStudent: notify,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); setBusy(false); return; }
      setResult(data);
      setName(""); setBody("");
      router.refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Prescribe a workout for {studentName}</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Pick a date and type, write or seed from the library, and save. {studentName} gets an email and sees it on their plan.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   className="input" required />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Session name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="input" placeholder="Tempo intervals" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="field-label" style={{ marginBottom: 0 }}>Workout</label>
            <button type="button" onClick={loadFromLibrary}
                    className="btn-ghost text-xs" style={{ padding: "4px 10px" }}>
              Load from library
            </button>
          </div>
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)}
                    className="input" required
                    placeholder="Markdown supported: **bold**, _italic_, # Heading, • bullet, [link](url)
Example:
# Tempo intervals
**Warm-up (10 min)**
• 5 min easy spin
• 5 × 30 sec build to RPE 6

**Main set**
• 3 × 8 min @ RPE 7 / 2 min recovery

**Cool-down**
• 5 min easy spin" />
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email {studentName} when I save
          </label>
          <button type="submit" disabled={busy || !body} className="btn-primary">
            {busy ? "Saving…" : "Prescribe workout"}
          </button>
        </div>

        {error && <p className="text-[var(--red,#e87262)] text-sm">⚠ {error}</p>}
        {result?.ok && (
          <p className="text-[var(--green,#5cb85c)] text-sm">
            ✓ Saved on week {result.week + 1} · day {result.day + 1}.
            {result.email?.id ? " Email sent." : result.email?.error ? ` Email failed: ${result.email.error}.` : ""}
          </p>
        )}
      </form>
    </div>
  );
}
