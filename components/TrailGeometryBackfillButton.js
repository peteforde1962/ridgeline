"use client";

// Admin: loops one-region-at-a-time backfills. Each click runs until either
// every region group has been processed OR the user aborts.

import { useState } from "react";
import Icon from "@/lib/icons";

export default function TrailGeometryBackfillButton() {
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState(null);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const stopRef = { current: false };

  async function runOne(skipAnchorKeys) {
    const res = await fetch("/api/admin/backfill-trail-geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipAnchorKeys }),
    });
    return res.json();
  }

  async function runUntilDone() {
    setBusy(true); setDone(false); setLog([]); setTotals(null);
    stopRef.current = false;
    const skipped = [];
    const running = { groups: 0, filled: 0, no_match: 0 };

    while (!stopRef.current) {
      let r;
      try {
        r = await runOne(skipped);
      } catch (e) {
        setLog((l) => [...l, "⚠ Network error: " + e.message]);
        break;
      }
      if (r.error) { setLog((l) => [...l, "⚠ " + r.error]); break; }
      if (r.done) {
        setLog((l) => [...l, "✓ " + (r.message || "Done.")]);
        setDone(true);
        break;
      }

      running.groups += 1;
      running.filled += r.filled || 0;
      running.no_match += r.no_match_in_group || 0;
      setTotals({
        ...running,
        remaining_trails: r.remaining,
        remaining_groups: r.remaining_groups,
        no_anchor_overall: r.no_anchor_overall,
      });
      setLog((l) => [
        ...l,
        `${r.group_label}: ${r.filled}/${r.group_size} filled (${r.osm_returned} OSM trails returned${r.osm_error ? `, ⚠ ${r.osm_error}` : ""}). ${r.remaining_groups} groups left.`,
      ]);

      // If we filled none AND there are no matches, skip this anchor next time.
      if (r.filled === 0 && r.group_size > 0) skipped.push(r.groupKey);

      if (r.remaining === 0 || r.remaining_groups === 0) { setDone(true); break; }
      await new Promise((res) => setTimeout(res, 800));
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={runUntilDone} disabled={busy}
                className="btn-primary text-sm inline-flex items-center gap-2">
          <Icon name="refresh" size={14} stroke="#1a2a30" />
          {busy ? "Backfilling…" : "Backfill trail geometry from OSM"}
        </button>
        {busy && (
          <button onClick={() => { stopRef.current = true; }}
                  className="btn-ghost text-sm">
            Stop
          </button>
        )}
      </div>

      {totals && (
        <div className="text-xs text-[var(--muted)] mt-3 leading-relaxed">
          <div>
            <strong>{totals.filled}</strong> filled across <strong>{totals.groups}</strong> region{totals.groups === 1 ? "" : "s"}
            {totals.no_match > 0 && <> · {totals.no_match} no OSM match</>}
            {totals.no_anchor_overall > 0 && <> · {totals.no_anchor_overall} no anchor</>}
          </div>
          {!done && (
            <div>{totals.remaining_trails} trails · {totals.remaining_groups} groups remaining…</div>
          )}
          {done && <div className="text-[var(--green,#5cb85c)] font-semibold mt-1">✓ Done.</div>}
        </div>
      )}

      {log.length > 0 && (
        <details className="mt-2" open>
          <summary className="text-xs text-[var(--muted)] cursor-pointer">Batch log</summary>
          <ul className="text-[11px] text-[var(--muted)] mt-2 space-y-1 font-mono max-h-48 overflow-y-auto">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
