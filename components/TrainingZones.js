"use client";

// Profile sub-card: capture FTP, LTHR, and HR max so the TSS formulas have
// real anchors instead of falling back to the duration-tier estimate.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TrainingZones({ profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [ftp,   setFtp]   = useState(profile?.ftp   || "");
  const [lthr,  setLthr]  = useState(profile?.lthr  || "");
  const [hrMax, setHrMax] = useState(profile?.hr_max || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      ftp:    ftp   === "" ? null : parseInt(ftp,   10),
      lthr:   lthr  === "" ? null : parseInt(lthr,  10),
      hr_max: hrMax === "" ? null : parseInt(hrMax, 10),
    }).eq("id", profile.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Training zones</h2>
      <p className="text-sm text-[var(--muted)] mb-3">
        Tell us your thresholds so we can compute proper TSS / fitness / fatigue.
        Without these we fall back to a duration-based estimate.
      </p>
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="field-label">FTP (W)</label>
          <input type="number" min="50" max="500" value={ftp}
                 onChange={(e) => setFtp(e.target.value)}
                 className="input" placeholder="e.g. 250" />
          <p className="text-xs text-[var(--muted)] mt-1">Functional Threshold Power. Required for power-based TSS.</p>
        </div>
        <div>
          <label className="field-label">LTHR (bpm)</label>
          <input type="number" min="100" max="220" value={lthr}
                 onChange={(e) => setLthr(e.target.value)}
                 className="input" placeholder="e.g. 165" />
          <p className="text-xs text-[var(--muted)] mt-1">Lactate Threshold HR. Used for hrTSS if no power.</p>
        </div>
        <div>
          <label className="field-label">Max HR (bpm)</label>
          <input type="number" min="120" max="230" value={hrMax}
                 onChange={(e) => setHrMax(e.target.value)}
                 className="input" placeholder="e.g. 188" />
          <p className="text-xs text-[var(--muted)] mt-1">Personal max — improves zone calculations.</p>
        </div>
        <div className="md:col-span-3 flex items-center gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save zones"}
          </button>
          {saved && <span className="text-[var(--green,#5cb85c)] text-sm">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}
