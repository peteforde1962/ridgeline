"use client";

// Tiny client button that re-runs trail detection for a single ride.
// Shows the JSON debug output inline so we can see exactly what happened.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/lib/icons";

export default function ResyncOneRideButton({ stravaActivityId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/strava/sync-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strava_activity_id: stravaActivityId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Sync failed");
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="mb-4">
      <button onClick={go} disabled={busy}
              className="btn-ghost text-xs inline-flex items-center gap-1.5"
              style={{ padding: "5px 12px" }}>
        <Icon name="refresh" size={12} />
        {busy ? "Re-syncing…" : "Re-sync this ride from Strava"}
      </button>
      {error && <p className="text-[var(--red,#e87262)] text-xs mt-2">⚠ {error}</p>}
      {result && (
        <details open className="mt-2">
          <summary className="text-xs text-[var(--muted)] cursor-pointer">
            ✓ Trails matched: {result.trails_matched} · Inserted into ride_trails: {result.ride_trails_inserted}
            {result.ride_trails_insert_error && <span className="text-[var(--red,#e87262)]"> · ⚠ insert error</span>}
          </summary>
          <pre className="text-[10px] mt-2 p-3 rounded overflow-x-auto"
               style={{ background: "var(--bg2)", border: "1px solid var(--line)", maxHeight: 320 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
