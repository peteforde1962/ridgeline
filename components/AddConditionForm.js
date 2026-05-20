"use client";

// Submit a trail condition report.

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { v: "dry",    label: "Dry" },
  { v: "tacky",  label: "Tacky / hero dirt" },
  { v: "wet",    label: "Wet" },
  { v: "muddy",  label: "Muddy" },
  { v: "snow",   label: "Snow / frozen" },
  { v: "closed", label: "Closed" },
];

export default function AddConditionForm({ trailName, region }) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [status, setStatus] = useState("dry");
  const [notes, setNotes]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk]       = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOk(false);
    try {
      const res = await fetch("/api/trail-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trail_name: trailName, region, status, notes }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Submit failed");
      else { setOk(true); setNotes(""); router.refresh(); setTimeout(() => setOpen(false), 1200); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs" style={{ padding: "5px 10px" }}>
        + Report condition
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="p-3 rounded-lg mt-2"
          style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
      <div className="mb-2">
        <label className="field-label">Trail: {trailName}</label>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input text-sm">
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="optional notes — rooty, rocks loose, etc."
          className="input text-sm"
        />
      </div>
      {error && <p className="text-[var(--red)] text-xs mb-2">⚠ {error}</p>}
      {ok    && <p className="text-[var(--green)] text-xs mb-2">✓ Reported</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-xs" style={{ padding: "5px 12px" }}>
          {busy ? "…" : "Submit"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs" style={{ padding: "5px 12px" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
