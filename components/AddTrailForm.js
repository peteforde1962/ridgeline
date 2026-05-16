"use client";

// Add a new trail — appears in dropdowns when logging rides.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddTrailForm({ userId }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [length, setLength] = useState("");
  const [elev, setElev] = useState("");
  const [difficulty, setDifficulty] = useState("Blue");
  const [region, setRegion] = useState("Local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true); setError("");

    const { error } = await supabase.from("trails").insert({
      user_id: userId,
      name,
      length_mi: length ? +length : null,
      elev_ft: elev ? +elev : null,
      difficulty,
      region,
    });

    setBusy(false);
    if (error) { setError(error.message); return; }
    setName(""); setLength(""); setElev(""); setDifficulty("Blue"); setRegion("Local");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
        + Add trail
      </button>
    );
  }

  return (
    <form onSubmit={handleSave} className="card mt-3" style={{ background: "var(--panel2,#1d2a23)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Add a trail</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-white">✕</button>
      </div>

      <div className="mb-3">
        <label className="field-label">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Length (mi)</label>
          <input type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} className="input" />
        </div>
        <div>
          <label className="field-label">Elevation (ft)</label>
          <input type="number" value={elev} onChange={(e) => setElev(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="field-label">Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
            {["Green","Blue","Black","Double Black"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="input">
            {["Local","Travel","Bucket list"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-sm">
          {busy ? "Saving…" : "Save trail"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
      </div>
    </form>
  );
}
