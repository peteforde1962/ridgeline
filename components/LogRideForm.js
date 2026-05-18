"use client";

// Log a ride with multi-trail support. After saving the ride row, also writes
// the selected trail ids into the ride_trails join table.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogRideForm({ userId, trails }) {
  const router = useRouter();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [trailIds, setTrailIds] = useState(new Set());
  const [trailQuery, setTrailQuery] = useState("");
  const [km, setKm] = useState("");
  const [elev, setElev] = useState("");
  const [minutes, setMinutes] = useState("");
  const [feel, setFeel] = useState(3);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleTrail(id) {
    setTrailIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Pre-fill from the FIRST trail picked
    if (trailIds.size === 0) {
      const t = trails.find((x) => x.id === id);
      if (t && !km)   setKm(t.length_km ?? "");
      if (t && !elev) setElev(t.elev_m ?? "");
    }
  }

  const filteredTrails = trailQuery
    ? trails.filter((t) => t.name.toLowerCase().includes(trailQuery.toLowerCase()))
    : trails;

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess("");

    if (!km || !minutes) {
      setBusy(false);
      setError("Add distance (km) and time.");
      return;
    }

    // Insert the ride first to get its id.
    const primaryTrail = trailIds.size > 0 ? Array.from(trailIds)[0] : null;
    const { data: insertedRows, error: rideError } = await supabase.from("rides")
      .insert({
        user_id: userId,
        trail_id: primaryTrail,        // back-compat: keep a "primary" trail
        date,
        km: +km,
        elev_m: elev ? +elev : null,
        minutes: +minutes,
        feel,
        notes: notes || null,
        source: "manual",
      })
      .select("id")
      .single();

    if (rideError) { setBusy(false); setError(rideError.message); return; }

    // Link all selected trails via the join table.
    if (trailIds.size > 0) {
      const rows = Array.from(trailIds).map((tid) => ({
        ride_id: insertedRows.id,
        trail_id: tid,
      }));
      const { error: linkError } = await supabase.from("ride_trails")
        .insert(rows);
      if (linkError) {
        // Non-fatal — ride exists, just warn.
        console.warn("Ride saved but trail linking failed:", linkError.message);
      }

      // Update trail PRs / last_ride for each linked trail.
      for (const tid of trailIds) {
        const t = trails.find((x) => x.id === tid);
        if (!t) continue;
        const newMin = +minutes;
        const newPR = !t.pr_minutes || newMin < t.pr_minutes ? newMin : t.pr_minutes;
        await supabase.from("trails")
          .update({ pr_minutes: newPR, last_ride: date })
          .eq("id", tid);
      }
    }

    setBusy(false);
    setSuccess("Ride logged.");
    setKm(""); setElev(""); setMinutes(""); setNotes(""); setFeel(3);
    setTrailIds(new Set());
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="card">
      <h2 className="text-lg font-bold mb-3">Log a ride</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div className="md:col-span-1">
          <label className="field-label">Trails (pick one or more)</label>
          <input
            value={trailQuery}
            onChange={(e) => setTrailQuery(e.target.value)}
            placeholder="Filter trails…"
            className="input text-sm"
          />
        </div>
      </div>

      <div className="mb-3 max-h-40 overflow-y-auto rounded-lg p-2"
           style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
        {filteredTrails.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No trails. Add one below the form.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTrails.map((t) => {
              const picked = trailIds.has(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggleTrail(t.id)}
                  className={picked ? "btn-primary" : "btn-ghost"}
                  style={{ padding: "5px 10px", fontSize: 12 }}
                >
                  {picked && <span className="mr-1">✓</span>}{t.name}
                </button>
              );
            })}
          </div>
        )}
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
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input"
                  placeholder="Felt strong on the climbs, washed out on Loose Larry…" />
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[var(--green)] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : "Save ride"}
      </button>
    </form>
  );
}
