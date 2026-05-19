"use client";

// Log a ride form. Single smart trail search box that handles local AND worldwide trails.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GlobalTrailSearchModal from "@/components/GlobalTrailSearchModal";

export default function LogRideForm({ userId, trails: initialTrails, redirectAfterSave = "/trails" }) {
  const router = useRouter();
  const supabase = createClient();

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

  // Live filter of local trails by the search query.
  const filteredLocal = useMemo(() => {
    if (!trailQuery) return trails;
    const q = trailQuery.toLowerCase();
    return trails.filter((t) => t.name.toLowerCase().includes(q));
  }, [trails, trailQuery]);

  // Trails the user has selected (chips at top of section).
  const selectedTrails = trails.filter((t) => trailIds.has(t.id));

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
    const { data: refreshed } = await supabase
      .from("trails").select("*").eq("user_id", userId).order("name");
    setTrails(refreshed || []);
    const newOne = (refreshed || []).find((t) => t.name === name);
    if (newOne) {
      setTrailIds((s) => new Set(s).add(newOne.id));
      if (!km && newOne.length_km) setKm(newOne.length_km);
      if (!elev && newOne.elev_m)  setElev(newOne.elev_m);
    }
    setTrailQuery("");
  }

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
      await supabase.from("ride_trails").insert(rows);
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
    setTimeout(() => router.push(redirectAfterSave), 600);
  }

  return (
    <>
      <form onSubmit={handleSave} className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="field-label">Find a trail</label>
            <input
              value={trailQuery}
              onChange={(e) => setTrailQuery(e.target.value)}
              placeholder="Type a trail name…"
              className="input text-sm"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedTrails.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-[var(--muted)] mb-1">Selected trails ({selectedTrails.length})</div>
            <div className="flex flex-wrap gap-2">
              {selectedTrails.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggleTrail(t.id)}
                  className="btn-primary"
                  style={{ padding: "5px 12px", fontSize: 12 }}
                >
                  ✓ {t.name} ✕
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtered local trails */}
        <div className="mb-3 max-h-44 overflow-y-auto rounded-lg p-2"
             style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          {filteredLocal.length === 0 ? (
            <div className="text-center p-3">
              <p className="text-xs text-[var(--muted)] mb-2">
                {trailQuery ? "No saved trail matches." : "No trails saved yet."}
              </p>
              <button
                type="button"
                onClick={() => setShowGlobal(true)}
                className="btn-primary text-xs"
                style={{ padding: "6px 14px" }}
              >
                🌍 Search worldwide{trailQuery ? ` for "${trailQuery}"` : ""}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredLocal.map((t) => {
                const picked = trailIds.has(t.id);
                if (picked) return null; // shown in chip strip above
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTrail(t.id)}
                    className="btn-ghost"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                  >
                    + {t.name}
                  </button>
                );
              })}
              {/* Also show worldwide button when results exist but user might want broader */}
              {trailQuery && (
                <button
                  type="button"
                  onClick={() => setShowGlobal(true)}
                  className="text-xs text-[var(--accent3)] hover:underline px-2 py-1"
                >
                  🌍 Or search worldwide
                </button>
              )}
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
        {success && <p className="text-[var(--green)] text-sm mb-3">✓ {success} Redirecting…</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save ride"}
          </button>
          <a href={redirectAfterSave} className="btn-ghost">Cancel</a>
        </div>
      </form>

      <GlobalTrailSearchModal
        open={showGlobal}
        onClose={() => setShowGlobal(false)}
        onImported={handleGlobalImported}
      />
    </>
  );
}
