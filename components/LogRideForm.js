"use client";

// Log a ride. Optionally tied to a trail — if so, also bumps that trail's PR and last_ride.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogRideForm({ userId, trails }) {
  const router = useRouter();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [trailId, setTrailId] = useState("");
  const [km, setKm] = useState("");
  const [elev, setElev] = useState("");
  const [minutes, setMinutes] = useState("");
  const [feel, setFeel] = useState(3);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleTrailPick(id) {
    setTrailId(id);
    const t = trails.find((t) => t.id === id);
    if (t && !km)   setKm(t.length_km ?? "");
    if (t && !elev) setElev(t.elev_m ?? "");
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess("");

    if (!km || !minutes) {
      setBusy(false);
      setError("Add distance (km) and time.");
      return;
    }

    const { error: rideError } = await supabase.from("rides").insert({
      user_id: userId,
      trail_id: trailId || null,
      date,
      km: +km,
      elev_m: elev ? +elev : null,
      minutes: +minutes,
      feel,
      notes: notes || null,
      source: "manual",
    });

    if (rideError) { setBusy(false); setError(rideError.message); return; }

    if (trailId) {
      const t = trails.find((x) => x.id === trailId);
      const newMin = +minutes;
      const newPR = !t.pr_minutes || newMin < t.pr_minutes ? newMin : t.pr_minutes;
      await supabase.from("trails")
        .update({ pr_minutes: newPR, last_ride: date })
        .eq("id", trailId);
    }

    setBusy(false);
    setSuccess("Ride logged.");
    setKm(""); setElev(""); setMinutes(""); setNotes(""); setFeel(3);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="card">
      <h2 className="text-lg font-bold mb-3">Log a ride</h2>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="field-label">Trail (optional)</label>
          <select value={trailId} onChange={(e) => handleTrailPick(e.target.value)} className="input">
            <option value="">— pick a trail —</option>
            {trails.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="field-label">Distance (km)</label>
          <input type="number" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} required className="input" />
        </div>
        <div>
          <label className="field-label">Elev (m)</label>
          <input type="number" value={elev} onChange={(e) => setElev(e.target.value)} className="input" />
        </div>
        <div>
          <label className="field-label">Time (min)</label>
          <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} required className="input" />
        </div>
      </div>

      <div className="mb-3">
        <label className="field-label">Feel</label>
        <select value={feel} onChange={(e) => setFeel(+e.target.value)} className="input">
          {[1,2,3,4,5].map((n) => <option key={n} value={n}>{"⭐".repeat(n)}</option>)}
        </select>
      </div>

      <div className="mb-4">
        <label className="field-label">Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Felt strong on the climbs, washed out on Loose Larry…" />
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[var(--green)] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : "Save ride"}
      </button>
    </form>
  );
}
