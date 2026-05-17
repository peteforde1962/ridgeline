"use client";

// Strava connection card: connect/disconnect + manual sync.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StravaCard({ connected, athleteId, lastSyncAt, strava }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSync() {
    setSyncing(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Sync failed"); }
      else { setResult(data); router.refresh(); }
    } catch (e) {
      setError(e.message);
    }
    setSyncing(false);
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Strava? Your imported rides will stay; you'll just stop auto-syncing new ones.")) return;
    const res = await fetch("/api/strava/disconnect", { method: "POST" });
    if (!res.ok) { alert("Disconnect failed."); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Strava</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Import your rides automatically. We pull distance, elevation, time, and date.
      </p>

      {strava === "connected" && (
        <p className="text-[var(--green)] text-sm mb-3">✓ Strava connected — sync your rides whenever you want.</p>
      )}
      {strava === "denied" && (
        <p className="text-[var(--red)] text-sm mb-3">⚠ You denied Strava access. Reconnect to import rides.</p>
      )}
      {strava === "exchange-failed" && (
        <p className="text-[var(--red)] text-sm mb-3">⚠ Token exchange failed. Check your Strava app config.</p>
      )}

      {!connected ? (
        <a href="/api/strava/connect" className="btn-primary">
          🚴 Connect Strava
        </a>
      ) : (
        <div>
          <div className="text-sm text-[var(--muted)] mb-3">
            Athlete ID: <span className="text-[var(--text)]">{athleteId || "—"}</span>
            {lastSyncAt && (
              <> · Last sync: <span className="text-[var(--text)]">{new Date(lastSyncAt).toLocaleString()}</span></>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSync} disabled={syncing} className="btn-primary">
              {syncing ? "Syncing…" : "⟳ Sync rides now"}
            </button>
            <button onClick={handleDisconnect} className="btn-ghost">
              Disconnect
            </button>
          </div>

          {result && (
            <p className="text-sm text-[var(--green)] mt-3">
              ✓ Imported {result.inserted} new ride{result.inserted === 1 ? "" : "s"}.
              {result.skipped > 0 && ` (${result.skipped} already in your library)`}
              {typeof result.matched === "number" && result.matched > 0 &&
                ` · Auto-linked ${result.matched} to a saved trail.`}
              {" "}Looked at {result.fetched} Strava activit{result.fetched === 1 ? "y" : "ies"}.
            </p>
          )}
          {error && <p className="text-sm text-[var(--red)] mt-3">⚠ {error}</p>}
        </div>
      )}
    </div>
  );
}
