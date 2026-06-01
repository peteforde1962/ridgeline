"use client";

// Admin: loops batches of OSM-geometry backfill until every trail without
// geometry is either filled or skipped (no ride anchor / no OSM match).

import { useState } from "react";
import Icon from "@/lib/icons";

export default function TrailGeometryBackfillButton() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);   // { processed, succeeded, ... }
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  async function runOne() {
    const res = await fetch("/api/admin/backfill-trail-geometry", { method: "POST" });
    return res.json();
  }

  async function runUntilDone() {
    setBusy(true); setDone(false); setLog([]); setProgress(null);
    const totals = { processed: 0, succeeded: 0, no_rides: 0, no_osm_match: 0, errors: 0 };
    while (true) {
      const r = await runOne();
      if (r.error) { setLog((l) => [...l, "⚠ " + r.error]); break; }
      totals.processed    += r.processed;
      totals.succeeded    += r.succeeded;
      totals.no_rides     += r.no_rides;
      totals.no_osm_match += r.no_osm_match;
      totals.errors       += (r.errors?.length || 0);
      setProgress({ ...totals, remaining: r.remaining });
      setLog((l) => [
        ...l,
        `Batch: ${r.succeeded}/${r.processed} filled · ${r.no_rides} no-anchor · ${r.no_osm_match} no-match · ${r.remaining} remaining`,
      ]);
      if (r.processed === 0 || r.remaining === 0) { setDone(true); break; }
      // Polite spacing — Overpass is shared infrastructure.
      await new Promise((res) => setTimeout(res, 1500));
    }
    setBusy(false);
  }

  return (
    <div>
      <button onClick={runUntilDone} disabled={busy}
              className="btn-primary text-sm inline-flex items-center gap-2">
        <Icon name="refresh" size={14} stroke="#1a2a30" />
        {busy ? "Backfilling…" : "Backfill trail geometry from OSM"}
      </button>

      {progress && (
        <div className="text-xs text-[var(--muted)] mt-3 leading-relaxed">
          <div><strong>{progress.succeeded}</strong> filled · <strong>{progress.no_rides}</strong> skipped (no ride anchor) · <strong>{progress.no_osm_match}</strong> no OSM match · <strong>{progress.errors}</strong> errors</div>
          {!done && <div>{progress.remaining} trail{progress.remaining === 1 ? "" : "s"} still to process…</div>}
          {done && <div className="text-[var(--green,#5cb85c)] font-semibold mt-1">✓ Done.</div>}
        </div>
      )}

      {log.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-[var(--muted)] cursor-pointer">Batch log</summary>
          <ul className="text-[11px] text-[var(--muted)] mt-2 space-y-1 font-mono">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
