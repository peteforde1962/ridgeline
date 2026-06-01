"use client";

// Coach-side per-day editor. Shows:
//   - Template (read-only) sessions for this day
//   - Existing prescribed/extras with edit + delete buttons
//   - "Add prescribed workout" form

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sessionLabel, sessionTagClass } from "@/lib/plan";
import { buildWorkoutFromLibrary } from "@/lib/workout-builder";
import Icon from "@/lib/icons";

const TYPES = ["ride", "strength", "yoga", "run", "rope"];

export default function CoachDaySessions({
  studentId, studentName, date, templateDay, storedSessions, coachId,
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);

  const extras = storedSessions.filter((s) => s.is_extra);
  const myPrescribed = extras.filter((e) => e.prescribed_by_coach_id === coachId);
  const otherExtras  = extras.filter((e) => !e.prescribed_by_coach_id);

  return (
    <div className="space-y-5">
      {/* Template sessions (read-only) */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Auto-generated plan</h2>
        {templateDay.details.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">Rest day in the auto plan.</p>
        ) : (
          <div className="space-y-2">
            {templateDay.details.map((s, i) => {
              const stored = storedSessions.find((r) => !r.is_extra && r.session_idx === i);
              const effType = stored?.swapped_to || s.type;
              return (
                <div key={i} className="card flex items-center gap-3" style={{ padding: "10px 14px" }}>
                  <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(effType)}`}>
                    {sessionLabel(effType)}
                  </span>
                  <span className="flex-1 text-sm">{s.name}</span>
                  {stored?.completed && <span className="text-[var(--green,#5cb85c)] text-xs">✓ done</span>}
                  {stored?.tweak === "skipped" && <span className="text-[var(--muted)] text-xs">skipped</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Coach's prescribed workouts for this day */}
      {myPrescribed.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Your prescribed workouts</h2>
          <div className="space-y-2">
            {myPrescribed.map((row) => (
              <PrescribedRow
                key={row.id} row={row}
                isEditing={editingId === row.id}
                onEdit={() => setEditingId(row.id)}
                onCancelEdit={() => setEditingId(null)}
                onChanged={() => { setEditingId(null); router.refresh(); }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Other extras (added by the student themselves or auto-imported rides) */}
      {otherExtras.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Student-added / auto-imported</h2>
          <div className="space-y-2">
            {otherExtras.map((e) => (
              <div key={e.id} className="card flex items-center gap-3" style={{ padding: "10px 14px" }}>
                <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(e.swapped_to || "ride")}`}>
                  {sessionLabel(e.swapped_to || "ride")}
                </span>
                <span className="flex-1 text-sm">{e.custom_name || "Extra session"}</span>
                {e.completed && <span className="text-[var(--green,#5cb85c)] text-xs">✓</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add a new prescribed workout */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Add a new prescribed workout</h2>
        <PrescribeForm studentId={studentId} studentName={studentName} date={date} onSaved={() => router.refresh()} />
      </section>
    </div>
  );
}

// ----------------------------------------------------------------

function PrescribedRow({ row, isEditing, onEdit, onCancelEdit, onChanged }) {
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this prescribed workout? The student will no longer see it.")) return;
    setBusy(true);
    const res = await fetch("/api/coaching/delete-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSessionId: row.id }),
    });
    setBusy(false);
    if (!res.ok) { alert(await res.text()); return; }
    onChanged();
  }

  if (isEditing) {
    return <EditForm row={row} onCancel={onCancelEdit} onSaved={onChanged} />;
  }

  return (
    <div className="card" style={{ borderColor: "rgba(248,182,166,.45)" }}>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded ${sessionTagClass(row.swapped_to || "ride")}`}>
          {sessionLabel(row.swapped_to || "ride")}
        </span>
        <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide"
              style={{ background: "var(--accent)", color: "#1a2a30" }}>
          Prescribed by you
        </span>
        <span className="flex-1 font-bold text-sm">{row.custom_name || "Workout"}</span>
        <button onClick={onEdit} className="btn-ghost text-xs inline-flex items-center gap-1"
                style={{ padding: "4px 10px" }}>
          <Icon name="pencil" size={12} /> Edit
        </button>
        <button onClick={del} disabled={busy} className="btn-ghost text-xs inline-flex items-center gap-1"
                style={{ padding: "4px 10px" }}>
          <Icon name="trash" size={12} /> Delete
        </button>
      </div>
      {row.ai_workout && (
        <pre className="text-xs whitespace-pre-wrap text-[var(--muted)] font-sans">{row.ai_workout.slice(0, 280)}{row.ai_workout.length > 280 ? "…" : ""}</pre>
      )}
    </div>
  );
}

// ----------------------------------------------------------------

function EditForm({ row, onCancel, onSaved }) {
  const [name, setName] = useState(row.custom_name || "");
  const [type, setType] = useState(row.swapped_to || "ride");
  const [body, setBody] = useState(row.ai_workout || "");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/coaching/edit-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSessionId: row.id, name, type, body }),
    });
    setBusy(false);
    if (!res.ok) { alert(await res.text()); return; }
    onSaved();
  }

  function loadFromLibrary() {
    const md = buildWorkoutFromLibrary({
      type, sessionName: name || `${type} session`, weekIndex: 0, dayIndex: 0, sessionIdx: 0,
    });
    if (md) setBody(md);
  }

  return (
    <form onSubmit={save} className="card space-y-3" style={{ borderColor: "rgba(248,182,166,.45)" }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map((t) => <option key={t} value={t}>{sessionLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="field-label" style={{ marginBottom: 0 }}>Workout</label>
          <button type="button" onClick={loadFromLibrary} className="btn-ghost text-xs" style={{ padding: "4px 10px" }}>
            Reload from library
          </button>
        </div>
        <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------

function PrescribeForm({ studentId, studentName, date, onSaved }) {
  const [type, setType] = useState("ride");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function loadFromLibrary() {
    const md = buildWorkoutFromLibrary({
      type, sessionName: name || `${type} session`, weekIndex: 0, dayIndex: 0, sessionIdx: 0,
    });
    if (md) setBody(md);
  }

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
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
    setBusy(false);
    if (!res.ok) { setError(data.error || "Failed"); return; }
    setName(""); setBody("");
    onSaved();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map((t) => <option key={t} value={t}>{sessionLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Tempo intervals" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="field-label" style={{ marginBottom: 0 }}>Workout</label>
          <button type="button" onClick={loadFromLibrary} className="btn-ghost text-xs" style={{ padding: "4px 10px" }}>
            Load from library
          </button>
        </div>
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="input" required
                  placeholder="Markdown supported. Click 'Load from library' to seed with real exercises." />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email {studentName} when I save
        </label>
        <button type="submit" disabled={busy || !body} className="btn-primary">
          {busy ? "Saving…" : "Add workout"}
        </button>
      </div>
      {error && <p className="text-[var(--red,#e87262)] text-sm">⚠ {error}</p>}
    </form>
  );
}
