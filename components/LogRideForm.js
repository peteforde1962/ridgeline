"use client";

// Log a ride with multi-trail support. Trails can come from your saved list
// OR you can search worldwide via OSM and import inline.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GlobalTrailSearchModal from "@/components/GlobalTrailSearchModal";

export default function LogRideForm({ userId, trails: initialTrails }) {
  const router = useRouter();
  const supabase = createClient();

  // Local copy of trails so we can add newly-imported global trails without a refresh.
  const [trails, setTrails] = useState(initialTrails);
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
  const [showGlobal, setShowGlobal] = useState(false);

  function toggleTrail(id) {
    setTrailIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (trailIds.size === 0) {
      const t = trails.find((x) => x.id === id);
      if (t && !km)   setKm(t.length_km ?? "");
      if (t && !elev) setElev(t.elev_m ?? "");
    }
  }

  async function handleGlobalImported({ name }) {
    // Re-fetch the user's trails so the newly imported one shows up.
    const { data: refreshed } = await supabase
      .from("trails").select("*").eq("user_id", userId).order("name");
    setTrails(refreshed || []);
    // Auto-select the new trail (find by name).
    const newOne = (refreshed || []).find((t) => t.name === name);
    if (newOne) {
      setTrailIds((s) => new Set(s).add(newOne.id));
      if (!km && newOne.length_km) setKm(newOne.length_km);
      if (!elev && newOne.elev_m)  setElev(newOne.elev_m);
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

    const primaryTrail = trailIds.size > 0 ? Array.from(trailIds)[0] : null;
    const { data: insertedRows, error: rideError } = await supabase.from("rides")
      .insert({
        user_id: userId,
        trail_id: primaryTrail,
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

    if (trailIds.size > 0) {
      const rows = Array.from(trailIds).map((tid) => ({
        ride_id: insertedRows.id, trail_id: tid,
      }));
      const { error: linkError } = await supabase.from("ride_trails").insert(rows);
      if (linkError) console.warn("Ride saved but trail linking failed:", linkError.message);

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
    <>
      <form onSubmit={handleSave} className="card">
        <h2 className="text-lg font-bold mb-3">Log a ride</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="field-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="field-label">Filter your trails</label>
            <input
              value={trailQuery}
              onChange={(e) => setTrailQuery(e.target.value)}
              placeholder="Type a trail name…"
              className="input text-sm"
            />
          </div>
        </div>

        <div className="mb-3 max-h-44 overflow-y-auto rounded-lg p-2"
             style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          {filteredTrails.length === 0 ? (
            <p className="text-xs text-[var(--muted)] p-2">
              {trailQuery ? "No saved trails match — try the worldwide search below." : "No trails saved yet."}
            </p>
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

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowGlobal(true)}
            className="btn-ghost text-sm"
            style={{ padding: "8px 14px" }}
          >
            🌍 Search worldwide trails…
          </button>
          <p className="text-xs text-[var(--muted)] mt-1">
            Trail you rode isn't saved yet? Find and import any trail in the world.
          </p>
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

      <GlobalTrailSearchModal
        open={showGlobal}
        onClose={() => setShowGlobal(false)}
        onImported={handleGlobalImported}
      />
    </>
  );
}
